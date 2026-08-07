import memoize from 'micro-memoize';
import { type CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import {
  type DecimalCount,
  type DisplayProcessor,
  type DisplayValue,
  type DisplayValueAlignmentFactors,
  type Field,
  type FieldSparkline,
  FieldType,
  formattedValueToString,
  type GrafanaTheme2,
  isDataFrame,
  type LinkModel,
} from '@grafana/data';
import { TableCellBackgroundDisplayMode, TableCellDisplayMode } from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../../../utils/colors';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { isGeometry, type OpenLayersContextValue } from '../../geo';
import { type TableCellOptions } from '../../types';
import { getAutoRendererDisplayMode } from '../Cells/renderers';

import { getCellOptions } from './fields';

/**
 * @internal
 * Getting gauge or sparkline values to align is very tricky without looking at all values and passing them through display processor.
 * For very large tables that could pretty expensive. So this is kind of a compromise. We look at the first 1000 rows and cache the longest value.
 * If we have a cached value we just check if the current value is longer and update the alignmentFactor. This can obviously still lead to
 * unaligned gauges but it should a lot less common.
 **/
export function getAlignmentFactor(
  field: Field,
  displayValue: DisplayValue,
  rowIndex: number
): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (formattedValueToString(alignmentFactor).length < formattedValueToString(displayValue).length) {
      alignmentFactor = { ...displayValue };
      field.state!.alignmentFactors = alignmentFactor;
    }
    return alignmentFactor;
  } else {
    // look at the next 1000 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display?.(field.values[i]) ?? field.values[i];
      if (formattedValueToString(alignmentFactor).length > formattedValueToString(nextDisplayValue).length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}

const CELL_COLOR_DARKENING_MULTIPLIER = 10;
const CELL_GRADIENT_HUE_ROTATION_DEGREES = 5;

/**
 * @internal
 * Returns the text and background colors for a table cell based on its options and display value.
 */
export function getCellColorInlineStylesFactory(theme: GrafanaTheme2) {
  const bgCellTextColor = memoize((color: string) => getTextColorForAlphaBackground(color, theme.isDark), {
    maxSize: 1000,
  });
  const darkeningFactor = theme.isDark ? 1 : -0.7; // How much to darken elements depends upon if we're in dark mode
  const gradientBg = memoize(
    (color: string) =>
      tinycolor(color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .spin(CELL_GRADIENT_HUE_ROTATION_DEGREES)
        .toRgbString(),
    { maxSize: 1000 }
  );
  const isTransparent = memoize(
    (color: string) => {
      // if hex, do the simple thing.
      if (color[0] === '#') {
        return color.length === 9 && color.endsWith('00');
      }
      // if not hex, just use tinycolor to avoid extra logic.
      return tinycolor(color).getAlpha() === 0;
    },
    { maxSize: 1000 }
  );

  return (cellOptions: TableCellOptions, displayValue: DisplayValue, hasApplyToRow: boolean): CSSProperties => {
    const result: CSSProperties = {};
    const displayValueColor = displayValue.color;

    if (!displayValueColor) {
      return result;
    }

    if (cellOptions.type === TableCellDisplayMode.ColorText) {
      result.color = displayValueColor;
    } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
      // return without setting anything if the bg is transparent. this allows
      // the cell to inherit the row bg color if `applyToRow` is set.
      if (hasApplyToRow && isTransparent(displayValueColor)) {
        return result;
      }

      const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;
      result.color = bgCellTextColor(displayValueColor);
      result.background =
        mode === TableCellBackgroundDisplayMode.Gradient
          ? `linear-gradient(120deg, ${gradientBg(displayValueColor)}, ${displayValueColor})`
          : displayValueColor;
    }

    return result;
  };
}

/**
 * @internal
 * if applyToRow is true in any field, return a function that gets the row background color
 */
export function getApplyToRowBgFn(
  fields: Field[],
  getCellColorInlineStyles: ReturnType<typeof getCellColorInlineStylesFactory>
): ((rowIndex: number) => CSSProperties) | void {
  for (const field of fields) {
    const cellOptions = getCellOptions(field);
    const fieldDisplay = field.display;
    if (
      fieldDisplay !== undefined &&
      cellOptions.type === TableCellDisplayMode.ColorBackground &&
      cellOptions.applyToRow === true
    ) {
      return (rowIndex: number) => getCellColorInlineStyles(cellOptions, fieldDisplay(field.values[rowIndex]), true);
    }
  }
}

/** @internal */
export function canFieldBeColorized(
  cellType: TableCellDisplayMode,
  applyToRowBgFn?: (rowIndex: number) => CSSProperties
) {
  return (
    cellType === TableCellDisplayMode.ColorBackground ||
    cellType === TableCellDisplayMode.ColorText ||
    Boolean(applyToRowBgFn)
  );
}

/**
 * @internal
 */
export const getCellLinks = (field: Field, rowIdx: number) => {
  let links: Array<LinkModel<unknown>> | undefined;
  if (field.getLinks) {
    links = field.getLinks({
      valueRowIndex: rowIdx,
    });
  }

  if (!links) {
    return;
  }

  for (let i = 0; i < links?.length; i++) {
    if (links[i].onClick) {
      const origOnClick = links[i].onClick;

      links[i].onClick = (event: MouseEvent) => {
        // Allow opening in new tab
        if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault();
          origOnClick!(event, {
            field,
            rowIndex: rowIdx,
          });
        }
      };
    }
  }

  return links.filter((link) => link.href || link.onClick != null);
};

export const displayJsonValue: (field: Field) => DisplayProcessor = (field: Field, decimals?: DecimalCount) => {
  const origDisplay = field.display!;
  return (value: unknown): DisplayValue => {
    const displayValue = origDisplay(value, decimals);

    let jsonText: string;
    if (!Array.isArray(value) && !isPlainObject(value)) {
      const formattedValue = formattedValueToString(displayValue);
      try {
        const parsed = JSON.parse(formattedValue);
        jsonText = JSON.stringify(parsed, null, ' ');
      } catch {
        jsonText = formattedValue; // Keep original if not valid JSON
      }
    } else {
      jsonText = JSON.stringify(value, null, ' ');
    }

    return { ...displayValue, text: jsonText };
  };
};

export function prepareSparklineValue(value: unknown, field: Field): FieldSparkline | undefined {
  if (Array.isArray(value)) {
    return {
      y: {
        name: `${field.name}-sparkline`,
        type: FieldType.number,
        values: value,
        config: {},
      },
    };
  }

  if (isDataFrame(value)) {
    const timeField = value.fields.find((x) => x.type === FieldType.time);
    const numberField = value.fields.find((x) => x.type === FieldType.number);

    if (timeField && numberField) {
      return { x: timeField, y: numberField };
    }
  }

  return;
}

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

export function buildInspectValue(
  value: unknown,
  field: Field,
  formatGeometry?: OpenLayersContextValue['formatGeometry']
): [string, TableCellInspectorMode] {
  const cellOptions = getCellOptions(field);

  let inspectValue: string;
  let mode = TableCellInspectorMode.text;

  if (field.type === FieldType.geo && isGeometry(value)) {
    inspectValue = formatGeometry ? formatGeometry(value) : JSON.stringify(value, null, '  ');
    mode = TableCellInspectorMode.code;
  } else if (
    cellOptions.type === TableCellDisplayMode.Sparkline ||
    getAutoRendererDisplayMode(field) === TableCellDisplayMode.Sparkline
  ) {
    // rather than JSON.stringify this, manually format it to make the coordinate tuples more legible to the user.
    const fieldSparkline = prepareSparklineValue(value, field);
    inspectValue = '[';
    if (fieldSparkline != null) {
      // if an x value exists, render as a tuple [x,y], otherwise just y
      const buildValString: (idx: number) => string =
        fieldSparkline.x != null
          ? (idx) => `[${fieldSparkline.x!.values[idx] ?? 'null'}, ${fieldSparkline.y.values[idx] ?? 'null'}]`
          : (idx) => `${fieldSparkline.y.values[idx] ?? 'null'}`;
      for (let i = 0; i < fieldSparkline.y.values.length; i++) {
        inspectValue += `\n  ${buildValString(i)}${i === fieldSparkline.y.values.length - 1 ? '\n' : ','}`;
      }
    }
    inspectValue += ']';
    mode = TableCellInspectorMode.code;
  } else if (cellOptions.type === TableCellDisplayMode.JSONView || Array.isArray(value) || isPlainObject(value)) {
    let toStringify = value;
    if (typeof value === 'string') {
      try {
        toStringify = JSON.parse(value);
      } catch {
        // do nothing, toStringify will stay as the raw string
      }
    }
    inspectValue = JSON.stringify(toStringify, null, '  ');
    mode = TableCellInspectorMode.code;
  } else {
    inspectValue = String(value ?? '');
  }

  return [inspectValue, mode];
}

// we keep this set to avoid spamming the heck out of the console, since it's quite likely that if we fail to parse
// a value once, it'll happen again and again for many rows in a table, and spamming the console is slow.
let warnedAboutStyleJsonSet = new Set<string>();
export function parseStyleJson(rawValue: unknown): CSSProperties | void {
  // confirms existence of value and serves as a type guard
  if (typeof rawValue === 'string') {
    try {
      const parsedJsonValue = JSON.parse(rawValue);
      if (parsedJsonValue != null && typeof parsedJsonValue === 'object' && !Array.isArray(parsedJsonValue)) {
        return parsedJsonValue;
      }
    } catch (e) {
      if (!warnedAboutStyleJsonSet.has(rawValue)) {
        console.error(`encountered invalid cell style JSON: ${rawValue}`, e);
        warnedAboutStyleJsonSet.add(rawValue);
      }
    }
  }
}
