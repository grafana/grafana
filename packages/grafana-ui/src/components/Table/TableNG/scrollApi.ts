import { useImperativeHandle, type ForwardedRef, type RefObject } from 'react';

import { type DataGridHandle } from '@grafana/react-data-grid';

import { type TableNGApi } from './types';

/**
 * Two frames: the first runs after `scrollToCell` commits, the second after rows
 * with estimated or min-content heights have been laid out and may have grown.
 */
const LAYOUT_ALIGN_FRAMES = 2;

/**
 * One pin loop per scroll container. A later scroll on that container cancels the
 * frame that has not run yet, so an older edge pin cannot snap the grid back.
 */
type PendingPin = {
  frame: number;
  generation: number;
};

const pendingPins = new WeakMap<HTMLElement, PendingPin>();
let nextPinGeneration = 0;

export function alignGridScroll(element: HTMLElement, edge: 'start' | 'end'): void {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = edge === 'start' ? 0 : maxScroll;
}

function cancelPendingPin(element: HTMLElement): void {
  const pending = pendingPins.get(element);
  if (pending == null) {
    return;
  }
  cancelAnimationFrame(pending.frame);
  pendingPins.delete(element);
}

function schedulePin(element: HTMLElement, edge: 'start' | 'end'): void {
  cancelPendingPin(element);
  const generation = ++nextPinGeneration;
  let remaining = LAYOUT_ALIGN_FRAMES;

  const pin = () => {
    if (pendingPins.get(element)?.generation !== generation) {
      return;
    }
    alignGridScroll(element, edge);
    remaining -= 1;
    // A scroll listener can start a new scroll while this pin is running.
    if (pendingPins.get(element)?.generation !== generation) {
      return;
    }
    if (remaining > 0) {
      pendingPins.set(element, { generation, frame: requestAnimationFrame(pin) });
    } else {
      pendingPins.delete(element);
    }
  };

  pendingPins.set(element, { generation, frame: requestAnimationFrame(pin) });
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

  const element = grid.element;
  if (element) {
    cancelPendingPin(element);
  }

  grid.scrollToCell({ rowIdx });
  if (!element || edge == null) {
    return;
  }

  schedulePin(element, edge);
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
            cancelPendingPin(element);
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
