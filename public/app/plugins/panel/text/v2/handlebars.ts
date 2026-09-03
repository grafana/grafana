import Handlebars from 'handlebars';

import {
  type DataFrame,
  type DateTimeInput,
  dateTimeFormat,
  formattedValueToString,
  getFieldDisplayName,
  type InterpolateFunction,
  isDateTime,
} from '@grafana/data';

/** One row of query data, keyed by field display name. */
export type TemplateRow = Record<string, unknown>;

interface TemplateFrame {
  name?: string;
  refId?: string;
  data: TemplateRow[];
}

export interface AllRowsContext {
  data: TemplateRow[];
  frames: TemplateFrame[];
}

export type TemplateContext = TemplateRow | AllRowsContext;

/** Throws when the template fails to render; callers surface the error. */
export type CompiledTemplate = (context: TemplateContext) => string;

// Values stay raw so the numeric helpers can compare them; `fmt` holds the
// display strings. Fields are assigned last so a field named `fmt` wins.
export function buildRows(frame: DataFrame, series: DataFrame[], maxRows = Infinity): TemplateRow[] {
  const names = frame.fields.map((field) => getFieldDisplayName(field, frame, series));

  return Array.from({ length: Math.max(Math.min(frame.length, maxRows), 0) }, (_, rowIndex) => {
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

// `maxRows` is a budget shared across frames, not a cap per frame.
export function buildAllRowsContext(series: DataFrame[], maxRows = Infinity): AllRowsContext {
  let remaining = maxRows;

  const frames = series.map((frame) => {
    const data = buildRows(frame, series, remaining);
    remaining -= data.length;

    return { name: frame.name, refId: frame.refId, data };
  });

  return {
    data: frames.find((frame) => frame.data.length > 0)?.data ?? [],
    frames,
  };
}

export function compileTemplate(content: string, replaceVariables: InterpolateFunction): CompiledTemplate {
  const env = createEnvironment(replaceVariables);

  // Parse up front so a syntax error throws here, not once per rendered row.
  return env.compile(env.parse(content));
}

const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
const toText = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

// A non-string separator is the options object, meaning the argument was omitted.
const toSeparator = (value: unknown): string => (typeof value === 'string' ? value : ',');

const isDateTimeInput = (value: unknown): value is DateTimeInput =>
  (typeof value === 'string' && value !== '') ||
  typeof value === 'number' ||
  value instanceof Date ||
  isDateTime(value);

// Handlebars appends its options object to every helper call.
const helperArgs = (args: unknown[]): unknown[] => args.slice(0, -1);

// `#if` counts `0` and an empty array as falsy, so the boolean helpers have to agree.
const isTruthy = (value: unknown): boolean => Boolean(value) && !Handlebars.Utils.isEmpty(value);

// Fresh per call: the variable helpers close over this panel's replaceVariables.
function createEnvironment(replaceVariables: InterpolateFunction) {
  const env = Handlebars.create();

  env.registerHelper({
    and: (...args: unknown[]) => helperArgs(args).every(isTruthy),
    or: (...args: unknown[]) => helperArgs(args).some(isTruthy),
    not: (left: unknown) => !isTruthy(left),
    eq: (left: unknown, right: unknown) => left === right,
    unlessEq: (left: unknown, right: unknown) => left !== right,
    gt: (left: unknown, right: unknown) => toNumber(left) > toNumber(right),
    gte: (left: unknown, right: unknown) => toNumber(left) >= toNumber(right),
    lt: (left: unknown, right: unknown) => toNumber(left) < toNumber(right),
    lte: (left: unknown, right: unknown) => toNumber(left) <= toNumber(right),
    contains: (haystack: unknown, value: unknown) =>
      Array.isArray(haystack) ? haystack.includes(value) : toText(haystack).includes(toText(value)),
    startsWith: (left: unknown, right: unknown) => toText(left).startsWith(toText(right)),
    endsWith: (left: unknown, right: unknown) => toText(left).endsWith(toText(right)),
    match: (left: unknown, right: unknown) => new RegExp(toText(right)).test(toText(left)),
    split: (value: unknown, separator: unknown) => toText(value).split(toSeparator(separator)),
    join: (value: unknown, separator: unknown) =>
      Array.isArray(value) ? value.join(toSeparator(separator)) : toText(value),
    toFixed: (value: unknown, digits: unknown) => {
      const num = toNumber(value);
      return Number.isFinite(num) && typeof digits === 'number' ? num.toFixed(digits) : toText(value);
    },
    json: (value: unknown) => JSON.stringify(value, null, 2),
    date: (...args: unknown[]) => {
      const [value, format] = helperArgs(args);
      // `{{date}}` with no argument means now; a missing or non-date value renders nothing.
      const input = args.length === 1 ? Date.now() : value;

      return isDateTimeInput(input)
        ? dateTimeFormat(input, { format: typeof format === 'string' ? format : undefined })
        : '';
    },
    // Collects the values instead of interpolating, so multi-value variables stay iterable.
    variable: (name: unknown) => {
      const values: string[] = [];
      replaceVariables(`$${toText(name)}`, {}, (value: string | string[]) => {
        values.push(...(Array.isArray(value) ? value : [value]));
        return '';
      });
      return values;
    },
    variableValue: (name: unknown) => replaceVariables(`$${toText(name)}`),
  });

  return env;
}
