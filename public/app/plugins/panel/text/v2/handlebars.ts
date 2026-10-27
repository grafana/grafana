import {
  type DataFrame,
  type DateTimeInput,
  dateTimeFormat,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
  isDateTime,
} from '@grafana/data';

import { type HelperResolver, toText } from './templateSandbox/helpers';

/** One row of query data, keyed by field display name. */
export type TemplateRow = Record<string, unknown>;

interface TemplateFrame {
  name?: string;
  refId?: string;
  data: TemplateRow[];
}

export interface AllRowsContext extends Record<string, unknown> {
  data: TemplateRow[];
  frames: TemplateFrame[];
}

export type TemplateContext = TemplateRow | AllRowsContext;

// Values stay raw so the numeric helpers can compare them; `fmt` holds the
// display strings. Fields are assigned last so a field named `fmt` wins.
export function buildRows(frame: DataFrame, series: DataFrame[], maxRows = Infinity, startRow = 0): TemplateRow[] {
  const names = frame.fields.map((field) => getFieldDisplayName(field, frame, series));

  return Array.from({ length: Math.max(Math.min(frame.length - startRow, maxRows), 0) }, (_, offset) => {
    const rowIndex = startRow + offset;
    const formatted: TemplateRow = {};
    const row: TemplateRow = { fmt: formatted };

    frame.fields.forEach((field, fieldIndex) => {
      const value = field.values[rowIndex];
      formatted[names[fieldIndex]] = field.display ? formattedValueToString(field.display(value)) : toText(value);
      row[names[fieldIndex]] = value;
    });

    return row;
  });
}

// `maxRows` is a budget shared across frames, not a cap per frame. `onRowsRead` fires when the
// template first reaches for a row collection, separating a budget that trimmed rows the template
// went on to read from one that trimmed rows nothing ever looked at. Both `data` properties are
// getters because every path to a row goes through one of them.
export function buildAllRowsContext(series: DataFrame[], maxRows = Infinity, onRowsRead?: () => void): AllRowsContext {
  let remaining = maxRows;

  const built = series.map((frame) => {
    const data = buildRows(frame, series, remaining);
    remaining -= data.length;

    return { name: frame.name, refId: frame.refId, data };
  });

  // Resolved before the getters are attached, so building the context reads no rows itself.
  const rootData = built.find((frame) => frame.data.length > 0)?.data ?? [];

  return {
    get data() {
      onRowsRead?.();
      return rootData;
    },
    frames: built.map(({ name, refId, data }) => ({
      name,
      refId,
      get data() {
        onRowsRead?.();
        return data;
      },
    })),
  };
}

export function createHostHelperResolver(replaceVariables: InterpolateFunction): HelperResolver {
  return (name, args) => {
    if (name === 'variable') {
      const values: string[] = [];
      replaceVariables(`$${toText(args[0])}`, {}, (value: string | string[]) => {
        values.push(...(Array.isArray(value) ? value : [value]));
        return '';
      });
      return values;
    }
    if (name === 'variableValue') {
      return replaceVariables(`$${toText(args[0])}`);
    }
    const [value, format] = args;
    const input = args.length === 0 ? Date.now() : value;
    return isDateTimeInput(input)
      ? dateTimeFormat(input, { format: typeof format === 'string' ? format : undefined })
      : '';
  };
}

const isDateTimeInput = (value: unknown): value is DateTimeInput =>
  (typeof value === 'string' && value !== '') ||
  typeof value === 'number' ||
  value instanceof Date ||
  isDateTime(value);
