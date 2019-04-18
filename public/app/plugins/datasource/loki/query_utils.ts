import { LokiExpression } from './types';

const selectorRegexp = /(?:^|\s){[^{]*}/g;
const caseInsensitive = '(?i)'; // Golang mode modifier for Loki, doesn't work in JavaScript
export function parseQuery(input: string): LokiExpression {
  input = input || '';
  const match = input.match(selectorRegexp);
  let selector = '';
  let filter = input;
  let query = input;

  if (match) {
    selector = match[0].trim();
    filter = input.replace(selectorRegexp, '').trim();
    if (filter && filter.search(/\|=|\|~|!=|!~/) === -1) {
      query = `${selector} |~ "${caseInsensitive}${filter}"`;
    }
  }

  return { selector, filter, query };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}
