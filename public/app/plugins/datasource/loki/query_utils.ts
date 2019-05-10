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
