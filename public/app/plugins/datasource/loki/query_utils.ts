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
      regexp = `${caseInsensitive}${regexp}`;
    } else {
      regexp = '';
    }
  }

  return { regexp, query };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}

export function getHighlighterExpressionsFromQuery(input: string): string[] {
  const parsed = parseQuery(input);
  // Legacy syntax
  if (parsed.regexp) {
    return [parsed.regexp];
  }
  let expression = input;
  const results = [];
  while (expression) {
    const filterStart = expression.search(/\|=|\|~|!=|!~/);
    if (filterStart === -1) {
      return results;
    }
    const skip = expression.substr(filterStart).search(/!=|!~/) === 0;
    expression = expression.substr(filterStart + 2);
    if (skip) {
      continue;
    }
    const filterEnd = expression.search(/\|=|\|~|!=|!~/);
    let filterTerm;
    if (filterEnd === -1) {
      filterTerm = expression.trim();
    } else {
      filterTerm = expression.substr(0, filterEnd);
      expression = expression.substr(filterEnd);
    }

    results.push(filterTerm.replace(/^\s*"/g, '').replace(/"\s*$/g, ''));
  }
  return results;
}
