import Handlebars from 'handlebars/runtime';

export type HostHelper = 'date' | 'variable' | 'variableValue';
export type HelperResolver = (name: HostHelper, args: unknown[]) => string | string[];
export const toText = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));
const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value));
const toSeparator = (value: unknown): string => (typeof value === 'string' ? value : ',');
const helperArgs = (args: unknown[]): unknown[] => args.slice(0, -1);
const isTruthy = (value: unknown): boolean => Boolean(value) && !Handlebars.Utils.isEmpty(value);

export function createTemplateHelpers(resolve: HelperResolver) {
  return {
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
    date: (...args: unknown[]) => resolve('date', helperArgs(args).slice(0, 2)),
    variable: (name: unknown) => resolve('variable', [toText(name)]),
    variableValue: (name: unknown) => resolve('variableValue', [toText(name)]),
  };
}
