import { type TableRow } from './types';

/**
 * Decide from the full-width layout, never from widths already reduced by a scrollbar.
 * Browser-sized rows and horizontal overflow retain the conservative stable gutter.
 */
export function shouldReserveScrollbarGutter(
  rows: TableRow[],
  rowHeight: number | string | ((row: TableRow) => number),
  columnWidths: number[],
  availableWidth: number,
  availableHeight: number
): boolean {
  if (typeof rowHeight === 'string' || columnWidths.reduce((sum, width) => sum + width, 0) > availableWidth) {
    return true;
  }
  if (typeof rowHeight === 'number') {
    return rows.length * rowHeight > availableHeight;
  }
  let total = 0;
  for (const row of rows) {
    total += rowHeight(row);
    if (total > availableHeight) {
      return true;
    }
  }
  return availableHeight < 0;
}
