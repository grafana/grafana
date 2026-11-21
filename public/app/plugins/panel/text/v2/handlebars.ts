import Handlebars from 'handlebars';

import {
  type DataFrame,
  type DateTimeInput,
  type Field,
  dateTimeFormat,
  type DisplayValue,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  type InterpolateFunction,
  isDateTime,
} from '@grafana/data';

import { interpret } from './handlebarsInterpreter';

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

export const DISPLAY_PROPERTIES = [
  'text',
  'prefix',
  'suffix',
  'numeric',
  'color',
  'percent',
  'icon',
] as const satisfies ReadonlyArray<keyof DisplayValue>;

export type DisplayProperty = (typeof DISPLAY_PROPERTIES)[number];

class FieldDisplayValue implements Readonly<DisplayValue> {
  readonly text: DisplayValue['text'];
  readonly prefix: DisplayValue['prefix'];
  readonly suffix: DisplayValue['suffix'];
  readonly numeric: DisplayValue['numeric'];
  readonly color: DisplayValue['color'];
  readonly percent: DisplayValue['percent'];
  readonly icon: DisplayValue['icon'];

  constructor({ text, prefix, suffix, numeric, color, percent, icon }: DisplayValue) {
    this.text = text;
    this.prefix = prefix;
    this.suffix = suffix;
    this.numeric = numeric;
    this.color = color;
    this.percent = percent;
    this.icon = icon;
  }

  toString(): string {
    return formattedValueToString(this);
  }
}

interface RowSource {
  fields: Field[];
  fieldIndexes: Map<string, number>;
  rowIndex: number;
  displayValues?: Array<FieldDisplayValue | undefined>;
}

// `display` depends on row object identity. Helpers that sort or filter rows must preserve
// the original row objects; cloning them loses their source and makes `display` render nothing.
const rowSources = new WeakMap<object, RowSource>();

export function getFieldNames(frame: DataFrame, series: DataFrame[]): string[] {
  return frame.fields.map((field) => getFieldDisplayName(field, frame, series));
}

// Values stay raw so the numeric helpers can compare them; `fmt` holds the
// display strings. Fields are assigned last so a field named `fmt` wins.
//
// Formatting is the costly part of a row, and a template often reads few formatted values or
// none, so `fmt` is built on first read and each of its fields is formatted on first read.
// Own accessors rather than a Proxy: the interpreter only reads own properties, so a Proxy
// would run two traps on every read.
export function buildRows(frame: DataFrame, series: DataFrame[], maxRows = Infinity, startRow = 0): TemplateRow[] {
  const names = getFieldNames(frame, series);
  const fieldIndexes = new Map(names.map((name, fieldIndex) => [name, fieldIndex]));
  const formattedRows = new WeakMap<object, FormattedRow>();
  const state: FormattingState = { eager: false };
  const formattedFields = createFormattedFields(frame, names, formattedRows, state);

  return Array.from({ length: Math.max(Math.min(frame.length - startRow, maxRows), 0) }, (_, offset) => {
    const rowIndex = startRow + offset;
    const row: TemplateRow = {};

    Object.defineProperty(row, FORMATTED_KEY, {
      get(this: object) {
        if (state.eager) {
          return assign(this, FORMATTED_KEY, formatRow(frame, names, rowIndex));
        }

        const formatted = Object.defineProperties({}, formattedFields);
        formattedRows.set(formatted, { rowIndex, values: [], read: 0 });
        return assign(this, FORMATTED_KEY, formatted);
      },
      set(this: object, value: unknown) {
        assign(this, FORMATTED_KEY, value);
      },
      enumerable: true,
      configurable: true,
    });

    frame.fields.forEach((field, fieldIndex) => {
      row[names[fieldIndex]] = field.values[rowIndex];
    });

    rowSources.set(row, { fields: frame.fields, fieldIndexes, rowIndex });

    return row;
  });
}

function getDisplayValue(row: unknown, name: string): FieldDisplayValue | undefined {
  const source = isObject(row) ? rowSources.get(row) : undefined;
  const fieldIndex = source?.fieldIndexes.get(name);

  if (!source || fieldIndex === undefined) {
    return undefined;
  }

  const field = source.fields[fieldIndex];
  source.displayValues ??= [];

  return (source.displayValues[fieldIndex] ??= new FieldDisplayValue(
    (field.display ?? getDisplayProcessor())(field.values[source.rowIndex])
  ));
}

const FORMATTED_KEY = 'fmt';

interface FormattedRow {
  rowIndex: number;
  /** Display strings by field index, filled as they are read. */
  values: Array<string | undefined>;
  /** How many fields have been formatted. */
  read: number;
}

// Once one row has read most of its fields, the template most likely reads them all, and defining
// an accessor per field costs more than the formatting it would skip. Rows read after that build
// `fmt` the way it was built before it was lazy.
interface FormattingState {
  eager: boolean;
}

function formatValue(field: Field, value: unknown): string {
  return field.display ? formattedValueToString(field.display(value)) : toText(value);
}

function formatRow(frame: DataFrame, names: string[], rowIndex: number): TemplateRow {
  const formatted: TemplateRow = {};

  frame.fields.forEach((field, fieldIndex) => {
    formatted[names[fieldIndex]] = formatValue(field, field.values[rowIndex]);
  });

  return formatted;
}

// One accessor per field, shared by every row of the frame. Keyed by name in field order, so a
// later field with the same name wins and the keys keep the order assigning them gave.
function createFormattedFields(
  frame: DataFrame,
  names: string[],
  formattedRows: WeakMap<object, FormattedRow>,
  state: FormattingState
): PropertyDescriptorMap {
  const descriptors: PropertyDescriptorMap = Object.create(null);

  frame.fields.forEach((field, fieldIndex) => {
    const name = names[fieldIndex];

    // Assigning a string to `__proto__` does nothing, so it was never a key of `fmt`.
    if (name === '__proto__') {
      return;
    }

    descriptors[name] = {
      get(this: object) {
        const formatted = formattedRows.get(this);
        if (!formatted) {
          return undefined;
        }

        const cached = formatted.values[fieldIndex];
        if (cached !== undefined) {
          return cached;
        }

        const value = (formatted.values[fieldIndex] = formatValue(field, field.values[formatted.rowIndex]));
        if (++formatted.read * 2 > frame.fields.length) {
          state.eager = true;
        }

        return value;
      },
      set(this: object, value: unknown) {
        assign(this, name, value);
      },
      enumerable: true,
      configurable: true,
    };
  });

  return descriptors;
}

// Replaces an accessor with the plain property an assignment would have made.
function assign<T>(target: object, key: string, value: T): T {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
  return value;
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

export function compileTemplate(content: string, replaceVariables: InterpolateFunction): CompiledTemplate {
  // Parse up front so a syntax error throws here, not once per rendered row. Interpreted, since
  // compiling needs 'unsafe-eval'.
  return compileProgram(Handlebars.parse(content), replaceVariables);
}

export function compileProgram(program: hbs.AST.Program, replaceVariables: InterpolateFunction): CompiledTemplate {
  return interpret(program, createEnvironment(replaceVariables));
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

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

const hasOwn = (target: unknown, key: string): target is object =>
  isObject(target) && Object.prototype.hasOwnProperty.call(target, key);

const readOwn = (target: unknown, key: string): unknown => (hasOwn(target, key) ? Reflect.get(target, key) : undefined);

const isDisplayProperty = (name: string): name is DisplayProperty =>
  DISPLAY_PROPERTIES.some((property) => property === name);

const readDisplayProperty = (
  value: FieldDisplayValue | undefined,
  name: string
): DisplayValue[DisplayProperty] | undefined => (value && isDisplayProperty(name) ? value[name] : undefined);

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
    display(this: unknown, ...args: unknown[]) {
      const params = helperArgs(args);
      const options = args[args.length - 1];
      const isBlock = typeof readOwn(options, 'fn') === 'function';

      if (params.length === 0) {
        const field = readOwn(this, 'display');
        return isBlock ? env.helpers.blockHelperMissing.call(this, field, options) : field;
      }

      const [name, property] = params;
      const hash = readOwn(options, 'hash');
      const row = hasOwn(hash, 'row') ? Reflect.get(hash, 'row') : this;
      const value = getDisplayValue(row, toText(name));
      const result = params.length === 1 ? value : readDisplayProperty(value, toText(property));

      if (isBlock) {
        return env.helpers.with.call(this, result, options);
      }

      return result instanceof FieldDisplayValue ? result.toString() : result;
    },
  });

  return env;
}
