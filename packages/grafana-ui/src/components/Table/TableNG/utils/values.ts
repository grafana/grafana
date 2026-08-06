import { type CSSProperties } from 'react';

import {
  type DecimalCount,
  type DisplayProcessor,
  type DisplayValue,
  type Field,
  type FieldSparkline,
  FieldType,
  formattedValueToString,
  isDataFrame,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { TableCellInspectorMode } from '../../TableCellInspector';
import { isGeometry, type OpenLayersContextValue } from '../../geo';
import { getAutoRendererDisplayMode } from '../Cells/renderers';

import { getCellOptions } from './cellOptions';

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
