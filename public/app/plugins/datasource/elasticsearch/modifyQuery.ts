type ModifierType = '' | '-';

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function queryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  const regex = getFilterRegex(key, value);
  const matches = query.matchAll(regex);
  for (const match of matches) {
    if (modifier === '-' && match[0].startsWith(modifier)) {
      return true;
    }
    if (modifier === '' && !match[0].startsWith('-')) {
      return true;
    }
  }
  return false;
}

/**
 * Adds a label:"value" expression to the query.
 */
export function addFilterToQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  if (queryHasFilter(query, key, value, modifier)) {
    return query;
  }

  const filter = `${modifier}${key}:"${value}"`;

  return query === '' ? filter : `${query} AND ${filter}`;
}

function getFilterRegex(key: string, value: string) {
  return new RegExp(`[-]{0,1}\\s*${key}\\s*:\\s*["']{0,1}${value}["']{0,1}`, 'ig');
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  const regex = getFilterRegex(key, value);
  const matches = query.matchAll(regex);
  const opRegex = new RegExp(`\\s+(?:AND|OR)\\s*$|^\\s*(?:AND|OR)\\s+`, 'ig');
  for (const match of matches) {
    if (modifier === '-' && match[0].startsWith(modifier)) {
      query = query.replace(regex, '').replace(opRegex, '');
    }
    if (modifier === '' && !match[0].startsWith('-')) {
      query = query.replace(regex, '').replace(opRegex, '');
    }
  }
  query = query.replace(/AND\s+OR/gi, 'OR');
  query = query.replace(/OR\s+AND/gi, 'AND');
  return query;
}
