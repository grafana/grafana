import memoize from 'micro-memoize';
import { type CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import {
  type DisplayValue,
  type DisplayValueAlignmentFactors,
  type Field,
  formattedValueToString,
  type GrafanaTheme2,
} from '@grafana/data';
import { TableCellBackgroundDisplayMode, TableCellDisplayMode } from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../../../utils/colors';
import { type TableCellOptions } from '../../types';

import { getCellOptions } from './cellOptions';

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
