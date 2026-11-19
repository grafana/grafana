import { useImperativeHandle, type ForwardedRef, type RefObject } from 'react';

import { type DataGridHandle } from '@grafana/react-data-grid';

import { type TableNGApi } from './types';

/**
 * Two frames: the first runs after `scrollToCell` commits, the second after rows
 * with estimated or min-content heights have been laid out and may have grown.
 */
const LAYOUT_ALIGN_FRAMES = 2;

export function alignGridScroll(element: HTMLElement, edge: 'start' | 'end'): void {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = edge === 'start' ? 0 : maxScroll;
}

/**
 * Scroll to a row in the grid's current row list. `edge` pins the scroll container
 * to the top or bottom after layout, which `scrollToCell` does not do when the
 * target row is taller than the viewport or its height was only estimated.
 */
export function scrollToDisplayedRow(
  grid: Pick<DataGridHandle, 'element' | 'scrollToCell'> | null,
  rowIdx: number,
  edge?: 'start' | 'end'
): void {
  if (!grid || !Number.isInteger(rowIdx) || rowIdx < 0) {
    return;
  }

  grid.scrollToCell({ rowIdx });
  const element = grid.element;
  if (!element || edge == null) {
    return;
  }

  let remaining = LAYOUT_ALIGN_FRAMES;
  const pin = () => {
    alignGridScroll(element, edge);
    remaining -= 1;
    if (remaining > 0) {
      requestAnimationFrame(pin);
    }
  };
  requestAnimationFrame(pin);
}

export function useTableScrollHandle(
  ref: ForwardedRef<TableNGApi>,
  gridRef: RefObject<DataGridHandle | null>,
  displayedRowCount: number
): void {
  useImperativeHandle(
    ref,
    () => ({
      scrollToTop() {
        if (displayedRowCount <= 0) {
          const element = gridRef.current?.element;
          if (element) {
            alignGridScroll(element, 'start');
          }
          return;
        }
        scrollToDisplayedRow(gridRef.current, 0, 'start');
      },
      scrollToBottom() {
        if (displayedRowCount <= 0) {
          return;
        }
        scrollToDisplayedRow(gridRef.current, displayedRowCount - 1, 'end');
      },
      scrollToRow(index: number) {
        if (!Number.isInteger(index) || index < 0 || index >= displayedRowCount) {
          return;
        }
        scrollToDisplayedRow(gridRef.current, index);
      },
    }),
    [displayedRowCount, gridRef]
  );
}
