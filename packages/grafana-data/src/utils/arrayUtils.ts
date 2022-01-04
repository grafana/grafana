import { SortOrder } from '@grafana/schema';

/** @internal */
export function moveItemImmutably<T>(arr: T[], from: number, to: number) {
  const clone = [...arr];
  Array.prototype.splice.call(clone, to, 0, Array.prototype.splice.call(clone, from, 1)[0]);
  return clone;
}

/**
 * Given a sort order and a value, return a function that can be used to sort values
 * Null values are always sorted to the end regardless of the sort order
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function sortValues(sort: SortOrder.Ascending | SortOrder.Descending) {
  return (a: any, b: any) => {
    if (a === b) {
      return 0;
    }

    if (b == null) {
      return -1;
    }
    if (a == null) {
      return 1;
    }

    if (sort === SortOrder.Descending) {
      return collator.compare(b, a);
    }
    return collator.compare(a, b);
  };
}
