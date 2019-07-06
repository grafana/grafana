import { LokiExpression } from './types';

const selectorRegexp = /(?:^|\s){[^{]*}/g;
const caseInsensitive = '(?i)'; // Golang mode modifier for Loki, doesn't work in JavaScript
export function parseQuery(input: string): LokiExpression {
  input = input || '';
  const match = input.match(selectorRegexp);
  let query = input;
  let regexp = '';

  if (match) {
    regexp = input.replace(selectorRegexp, '').trim();
    // Keep old-style regexp, otherwise take whole query
    if (regexp && regexp.search(/\|=|\|~|!=|!~/) === -1) {
      query = match[0].trim();
      if (!regexp.startsWith(caseInsensitive)) {
        regexp = `${caseInsensitive}${regexp}`;
      }
    } else {
      regexp = '';
    }
  }

  return { regexp, query };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}

/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= foo |=bar != baz` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input: string): string[] {
  const parsed = parseQuery(input);
  // Legacy syntax
  if (parsed.regexp) {
    return [parsed.regexp];
  }
  let expression = input;
  const results = [];
  // Consume filter expression from left to right
  while (expression) {
    const filterStart = expression.search(/\|=|\|~|!=|!~/);
    // Nothing more to search
    if (filterStart === -1) {
      break;
    }
    // Drop terms for negative filters
    const skip = expression.substr(filterStart).search(/!=|!~/) === 0;
    expression = expression.substr(filterStart + 2);
    if (skip) {
      continue;
    }
    // Check if there is more chained
    const filterEnd = expression.search(/\|=|\|~|!=|!~/);
    let filterTerm;
    if (filterEnd === -1) {
      filterTerm = expression.trim();
    } else {
      filterTerm = expression.substr(0, filterEnd).trim();
      expression = expression.substr(filterEnd);
    }

    // Unwrap the filter term by removing quotes
    const quotedTerm = filterTerm.match(/^"((?:[^\\"]|\\")*)"$/);

    if (quotedTerm) {
      const unwrappedFilterTerm = quotedTerm[1];
      results.push(unwrappedFilterTerm);
    } else {
      return null;
    }
  }
  return results;
}
