const selectorRegexp = /(?:^|\s){[^{]*}/g;
export function parseQuery(input: string) {
  const match = input.match(selectorRegexp);
  let query = '';
  let regexp = input;

  if (match) {
    query = match[0].trim();
    regexp = input.replace(selectorRegexp, '').trim();
  }

  return { query, regexp };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}
