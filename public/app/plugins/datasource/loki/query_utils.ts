import { LokiExpression } from './types';

const selectorRegexp = /(?:^|\s){[^{]*}/g;
const caseInsensitive = '(?i)'; // Golang mode modifier for Loki, doesn't work in JavaScript
export function parseQuery(input: string): LokiExpression {
  input = input || '';
  const match = input.match(selectorRegexp);
  let query = '';
  let regexp = input;

  if (match) {
    // Selector
    query = match[0].trim();
    regexp = input.replace(selectorRegexp, '').trim();
    if (regexp && regexp.search(/\|=|\|~|!=|!~/) === -1) {
      regexp = `|~ "${caseInsensitive}${regexp}"`;
    }
  }

  return { regexp, query };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}
