import { escapeRegex } from '@grafana/data';

type ModifierType = '' | '-';

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function queryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  key = escapeFilter(key);
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

  key = escapeFilter(key);
  const filter = `${modifier}${key}:"${value}"`;

  return query === '' ? filter : `${query} AND ${filter}`;
}

function getFilterRegex(key: string, value: string) {
  return new RegExp(`[-]{0,1}\\s*${escapeRegex(key)}\\s*:\\s*["']{0,1}${escapeRegex(value)}["']{0,1}`, 'ig');
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  key = escapeFilter(key);
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

/**
 * Filters can possibly contain colons, which are used as a separator in the query.
 * Use this function to escape filter keys.
 */
export function escapeFilter(value: string) {
  return value.replace(/:/g, '\\:');
}
