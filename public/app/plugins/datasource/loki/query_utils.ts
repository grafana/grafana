import { LokiExpression } from './types';

const selectorRegexp = /(?:^|\s){[^{]*}/g;
export function parseQuery(input: string): LokiExpression {
  input = input || '';
  const match = input.match(selectorRegexp);
  let query = '';
  let regexp = input;

  if (match) {
    // Selector
    query = match[0].trim();
    regexp = input.replace(selectorRegexp, '').trim();
  }

  return { regexp, query };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}
