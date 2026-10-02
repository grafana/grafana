const BACKSLASH_REGEX = /\\/g;
const AND_SPLIT_REGEX = /\s*&&\s*/;
const OR_SPLIT_REGEX = /\s*\|\|\s*/;
const CLAUSE_REGEX = /^\$\s*(>=|<=|!==|!=|===|==|>|<|=)\s*(.+)$/;

export enum ExpressionOperator {
  EQ = '=',
  DOUBLE_EQ = '==',
  STRICT_EQ = '===',
  NOT_EQ = '!=',
  STRICT_NOT_EQ = '!==',
  GT = '>',
  GTE = '>=',
  LT = '<',
  LTE = '<=',
}
const QUOTED_STRING_REGEX = /^(['"`])(.*)\1$/;
const DATE_REGEX = /^(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2})/;

export type ComparableValue = string | number | boolean;
export type Predicate = (v: ComparableValue) => boolean;

const COMPARABLE_VALUE_CACHE_MAX = 2048;
const comparableValueCache = new Map<string, ComparableValue>();

const parseComparableValue = (value: string): ComparableValue => {
  if (DATE_REGEX.test(value)) {
    const ms = new Date(value).getTime();
    if (!isNaN(ms)) {
      return ms;
    }
  }

  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num;
  }

  const lvalue = value.toLowerCase();
  if (lvalue === 'true' || lvalue === 'false') {
    return lvalue === 'true';
  }

  return value;
};

export const comparableValue = (value: string): ComparableValue => {
  const key = value.trim().replace(BACKSLASH_REGEX, '');
  const cached = comparableValueCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = parseComparableValue(key);
  if (comparableValueCache.size >= COMPARABLE_VALUE_CACHE_MAX) {
    comparableValueCache.clear();
  }
  comparableValueCache.set(key, result);
  return result;
};

export const makeComparator = (op: string, rhs: ComparableValue): Predicate => {
  switch (op) {
    case ExpressionOperator.EQ:
    case ExpressionOperator.DOUBLE_EQ:
    case ExpressionOperator.STRICT_EQ:
      return (v) => v === rhs;

    case ExpressionOperator.GT:
      return (v) => v > rhs;
    case ExpressionOperator.GTE:
      return (v) => v >= rhs;

    case ExpressionOperator.LT:
      return (v) => v < rhs;
    case ExpressionOperator.LTE:
      return (v) => v <= rhs;

    case ExpressionOperator.NOT_EQ:
    case ExpressionOperator.STRICT_NOT_EQ:
      return (v) => v !== rhs;

    default:
      return () => false;
  }
};

const parseClause = (clause: string): Predicate | null => {
  const match = clause.trim().match(CLAUSE_REGEX);

  if (!match) {
    return null;
  }

  const raw = match[2].trim();
  const quoted = raw.match(QUOTED_STRING_REGEX);
  const rhs = quoted ? quoted[2] : comparableValue(raw);
  return makeComparator(match[1], rhs);
};

export const parseExpression = (xpr: string): Predicate | null => {
  const andGroups = xpr
    .replace(BACKSLASH_REGEX, '')
    .split(OR_SPLIT_REGEX)
    .map((group) => {
      const clauses = group.split(AND_SPLIT_REGEX).map(parseClause);

      if (clauses.some((p) => p === null)) {
        return null;
      }

      const fns = clauses.filter((p): p is Predicate => p !== null);
      if (fns.length === 1) {
        return fns[0];
      }
      return (v: ComparableValue) => fns.every((p) => p(v));
    });

  if (andGroups.some((g) => g === null)) {
    return null;
  }

  const groups = andGroups.filter((g): g is Predicate => g !== null);
  if (groups.length === 1) {
    return groups[0];
  }
  return (v: ComparableValue) => groups.some((g) => g(v));
};
