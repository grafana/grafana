import { AdHocFilterWithLabels } from '@grafana/scenes';

/**
 * Custom expression builder for Prometheus that properly handles regex operators.
 * Unlike the default builder, this doesn't escape regex metacharacters when using =~ or !~
 * operators, allowing users to enter raw regex patterns.
 */
export function prometheusExpressionBuilder(filters: AdHocFilterWithLabels[]): string {
  const applicableFilters = filters.filter((f) => !f.nonApplicable && !f.hidden);
  return applicableFilters.map(renderFilter).join(',');
}

// Map multi-value operators to their regex equivalents
const MULTI_VALUE_OPERATOR_MAP: Record<string, string> = {
  '=|': '=~',
  '!=|': '!~',
};

function renderFilter(filter: AdHocFilterWithLabels): string {
  const { key, operator: rawOperator, value, values } = filter;

  // Transform multi-value operators to regex operators
  const operator = MULTI_VALUE_OPERATOR_MAP[rawOperator] ?? rawOperator;

  // Determine the escaped value based on operator type
  const escapedValue = getEscapedValue(rawOperator, value, values);

  return `${key}${operator}"${escapedValue}"`;
}

function getEscapedValue(operator: string, value: string | undefined, values: string[] | undefined): string {
  // Multi-value operators: escape each value as literal and join with |
  if (operator === '=|' || operator === '!=|') {
    return values?.map(escapeAsLiteral).join('|') ?? '';
  }

  // Regex operators: preserve regex metacharacters
  if (operator === '=~' || operator === '!~') {
    return escapeStringLiteral(value);
  }

  // Exact match operators: escape string literal only
  return escapeStringLiteral(value);
}

/**
 * Escapes a value for use in PromQL string literals.
 * Only escapes backslashes, newlines, and double quotes.
 * Does NOT escape regex metacharacters.
 */
function escapeStringLiteral(value: string | undefined): string {
  if (!value) {
    return '';
  }
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

/**
 * Escapes a value for literal matching in multi-value selectors.
 * Escapes both string literal characters AND regex metacharacters.
 */
function escapeAsLiteral(value: string): string {
  return escapeStringLiteral(escapeRegexMetacharacters(value));
}

/**
 * Escapes regex metacharacters for literal matching.
 * Used when building multi-value selectors where each value should be matched literally.
 */
const RE2_METACHARACTERS = /[*+?()|\\.\[\]{}^$]/g;
function escapeRegexMetacharacters(value: string): string {
  return value.replace(RE2_METACHARACTERS, '\\$&');
}
