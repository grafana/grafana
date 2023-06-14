type ModifierType = '' | '-';

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function queryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  const regex = getFilterRegex(key, value, modifier);

  return regex.test(query);
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {}

/**
 * Adds a label:"value" expression to the query.
 */
export function addFilterToQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {}

function getFilterRegex(key: string, value: string, modifier: ModifierType = '') {
  return new RegExp(`${modifier}${key}\\s*:\\s*["']{0,1}${value}["']{0,1}`, 'ig');
}
