const selectorRegexp = /(?:^|\s){[^{]*}/g;
const caseInsensitive = '(?i)'; // Golang mode modifier for Loki, doesn't work in JavaScript
export function parseQuery(input: string) {
  input = input || '';
  const match = input.match(selectorRegexp);
  let query = '';
  let regexp = input;

  if (match) {
    query = match[0].trim();
    regexp = input.replace(selectorRegexp, '').trim();
  }

  if (regexp) {
    regexp = caseInsensitive + regexp;
  }
  return { query, regexp };
}

export function formatQuery(selector: string, search: string): string {
  return `${selector || ''} ${search || ''}`.trim();
}
