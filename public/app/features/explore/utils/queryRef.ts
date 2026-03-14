import { LogRowModel } from '@grafana/data';

/**
 * Determine if a given refId belongs to the requested query.
 * Frames without refId are treated as matching only when there's a single query in the pane.
 */
export function matchesQueryRef(refId: string | undefined, queryRef: string, allowUntyped: boolean) {
  if (!refId) {
    return allowUntyped;
  }

  return refId === queryRef;
}

export function filterByQueryRef<T extends { refId?: string }>(
  items: T[] | undefined,
  queryRef: string,
  allowUntyped: boolean
): T[] {
  if (!items?.length) {
    return [];
  }

  return items.filter((item) => matchesQueryRef(item.refId, queryRef, allowUntyped));
}

export function hasItemsForQuery<T extends { refId?: string }>(
  items: T[] | undefined,
  queryRef: string,
  allowUntyped: boolean
) {
  return filterByQueryRef(items, queryRef, allowUntyped).length > 0;
}

export function filterLogRowsByQueryRef(
  rows: LogRowModel[] | undefined,
  queryRef: string,
  allowUntyped: boolean
): LogRowModel[] {
  if (!rows?.length) {
    return [];
  }

  return rows.filter((row) => matchesQueryRef(row.dataFrame?.refId, queryRef, allowUntyped));
}
