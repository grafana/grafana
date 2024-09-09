import { chain, filter, matchesProperty, trim } from 'lodash';

/**
 * Filters a list of k8s items by a selector string
 */
export function filterBySelector<T>(items: T[], selector: string) {
  // e.g. [['path.to.key', 'value'], ['other.path', 'value']]
  const filters: string[][] = chain(selector)
    .split(',')
    .map(trim)
    .map((s) => s.split('='))
    .value();

  return filter(items, (item) =>
    filters.every(([key, value]) => {
      const matcher = matchesProperty(key, value);
      return matcher(item);
    })
  );
}
