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
import { t } from '@grafana/i18n';

/** One row of query data, keyed by field display name. */
export type TemplateRow = Record<string, unknown>;

export interface TemplateFrame {
  name?: string;
  refId?: string;
  data: TemplateRow[];
}

export interface AllRowsContext {
  data: TemplateRow[];
  frames: TemplateFrame[];
}

export type TemplateContext = TemplateRow | AllRowsContext;

/** Resolves to the error text instead of throwing when the template is broken. */
export type CompiledTemplate = (context: TemplateContext) => string;

// Keys and formatting mirror the ${__data.fields.<name>} macro, so both address fields the same way.
export function buildRows(frame: DataFrame, series: DataFrame[]): TemplateRow[] {
  const names = frame.fields.map((field) => getFieldDisplayName(field, frame, series));

  return Array.from({ length: frame.length }, (_, rowIndex) => {
    const row: TemplateRow = {};

    frame.fields.forEach((field, fieldIndex) => {
      const value = field.values[rowIndex];
      row[names[fieldIndex]] =
        field.config.unit && field.display ? formattedValueToString(field.display(value)) : value;
    });

    return row;
  });
}

export function buildAllRowsContext(series: DataFrame[]): AllRowsContext {
  const frames = series.map((frame) => ({
    name: frame.name,
    refId: frame.refId,
    data: buildRows(frame, series),
  }));

  return {
    data: frames.find((frame) => frame.data.length > 0)?.data ?? [],
    frames,
  };
}

export function compileTemplate(content: string, replaceVariables: InterpolateFunction): CompiledTemplate {
  let template: HandlebarsTemplateDelegate<TemplateContext>;

  try {
    const env = createEnvironment(replaceVariables);
    // Parsing up front keeps a syntax error to a single message; compile() would
    // defer it to the first render, which every row repeats.
    template = env.compile(env.parse(content));
  } catch (error) {
    const message = templateError(error);
    return () => message;
  }

  return (context) => {
    try {
      return template(context);
    } catch (error) {
      return templateError(error);
    }
  };
}

function templateError(error: unknown): string {
  return t('textng.render.handlebars-error', 'Handlebars error: {{message}}', {
    message: error instanceof Error ? error.message : String(error),
  });
}

const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
const toText = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

// Falls back to now for anything that isn't a date, including Handlebars' own options object,
// which every helper call receives as a trailing argument — covering `{{date}}` with no argument.
const toDateTimeInput = (value: unknown): DateTimeInput =>
  typeof value === 'string' || typeof value === 'number' || value instanceof Date || isDateTime(value)
    ? value
    : Date.now();

// A fresh environment per render keeps one panel's helpers from leaking into another's.
function createEnvironment(replaceVariables: InterpolateFunction) {
  const env = Handlebars.create();

  env.registerHelper({
    and: (left: unknown, right: unknown) => Boolean(left) && Boolean(right),
    or: (left: unknown, right: unknown) => Boolean(left) || Boolean(right),
    not: (left: unknown) => !left,
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
    match: (left: unknown, right: unknown) => toText(left).match(toText(right)) !== null,
    split: (value: unknown, separator: unknown) => toText(value).split(toText(separator)),
    join: (value: unknown, separator: unknown) =>
      Array.isArray(value) ? value.join(toText(separator)) : toText(value),
    toFixed: (value: unknown, digits: unknown) => {
      const num = toNumber(value);
      return Number.isFinite(num) && typeof digits === 'number' ? num.toFixed(digits) : 0;
    },
    json: (value: unknown) => JSON.stringify(value, null, 2),
    date: (value: unknown, format: unknown) =>
      dateTimeFormat(toDateTimeInput(value), { format: typeof format === 'string' ? format : undefined }),
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
