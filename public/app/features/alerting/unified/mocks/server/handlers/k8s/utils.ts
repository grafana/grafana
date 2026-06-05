import { chain, filter, get, trim } from 'lodash';

/**
 * Decodes escaped characters in field selector values.
 * Matches the Kubernetes API Machinery encoding from encodeFieldSelector.
 */
function decodeFieldSelectorValue(value: string): string {
  return value.replace(/\\,/g, ',').replace(/\\=/g, '=').replace(/\\\\/g, '\\');
}

/**
 * Filters a list of k8s items by a selector string
 */
export function filterBySelector<T>(items: T[], selector: string) {
  // e.g. [['path.to.key', 'value'], ['other.path', 'value']]
  const filters: string[][] = chain(selector)
    .split(',')
    .map(trim)
    .map((s) => {
      const [key, ...valueParts] = s.split('=');
      return [key, decodeFieldSelectorValue(valueParts.join('='))];
    })
    .value();

  return filter(items, (item) =>
    filters.every(([key, value]) => {
      return get(item, key) === value;
    })
  );
}
