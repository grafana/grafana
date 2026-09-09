import { FieldType, type LogRowModel } from '@grafana/data';
import { type TableSortByFieldState } from '@grafana/schema';
import { sortInAscendingOrder } from 'app/features/logs/utils';

function findSortField(log: LogRowModel, displayName: string) {
  return log.dataFrame?.fields.find(
    (field) =>
      field.name === displayName || field.state?.displayName === displayName || field.config.displayName === displayName
  );
}

// Same collator as TableNG so arrow-key order matches the visible table.
const compareStrings = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return compareStrings(String(a ?? ''), String(b ?? ''));
}

function compareLogsByColumn(a: LogRowModel, b: LogRowModel, displayName: string): number {
  const field = findSortField(a, displayName) ?? findSortField(b, displayName);
  if (field?.type === FieldType.time) {
    return sortInAscendingOrder(a, b);
  }
  if (field) {
    return compareValues(field.values[a.rowIndex], field.values[b.rowIndex]);
  }
  return compareValues(a.labels?.[displayName], b.labels?.[displayName]);
}

/** Reorders logs to match TableNG `sortBy` (any column). Empty `sortBy` keeps query order. */
export function sortLogsToMatchTable<T extends LogRowModel>(logs: T[], sortBy?: TableSortByFieldState[]): T[] {
  if (!logs.length || !sortBy?.length) {
    return logs;
  }

  return [...logs].sort((a, b) => {
    for (const { displayName, desc } of sortBy) {
      const result = compareLogsByColumn(a, b, displayName);
      if (result !== 0) {
        return desc ? -result : result;
      }
    }
    return 0;
  });
}
