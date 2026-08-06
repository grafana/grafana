import { useCallback, useLayoutEffect, useRef } from 'react';

import { type Column, type DataGridProps } from '@grafana/react-data-grid';
import { type MatcherScope } from '@grafana/schema';

import { type TableColumnResizeActionCallback } from '../../types';
import { type TableRow, type TableSummaryRow } from '../types';

/**
 * react-data-grid is a little unwieldy when it comes to column resize events.
 * we want to detect a few different column resize signals:
 *   - dragging the handle (only want to dispatch when handle is released)
 *   - double-clicking the handle (sets the column to the minimum width to fit content)
 * `onColumnResize` dispatches events throughout a dragged resize, and `onColumnWidthsChanged` doesn't
 * emit an event when double-click resizing occurs, so we have to build something custom on top of these
 * behaviors in order to get everything working.
 */
interface UseColumnResizeState {
  columnKey: string | undefined;
  width: number;
  fieldScope?: MatcherScope;
}

const INITIAL_COL_RESIZE_STATE = Object.freeze({ columnKey: undefined, width: 0 }) satisfies UseColumnResizeState;

export function useColumnResize(
  onColumnResize: TableColumnResizeActionCallback = () => {},
  fieldScope?: MatcherScope
): DataGridProps<TableRow, TableSummaryRow>['onColumnResize'] {
  // these must be refs. if we used setState, we would run into race conditions with these event listeners
  const colResizeState = useRef<UseColumnResizeState>({ ...INITIAL_COL_RESIZE_STATE });
  const pointerIsDown = useRef(false);

  // to detect whether we got a double-click resize, we track whether the pointer is currently down
  useLayoutEffect(() => {
    function pointerDown(_event: PointerEvent) {
      pointerIsDown.current = true;
    }

    function pointerUp(_event: PointerEvent) {
      pointerIsDown.current = false;
    }

    window.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);

    return () => {
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
    };
  });

  const dispatchEvent = useCallback(() => {
    if (colResizeState.current.columnKey) {
      onColumnResize(
        colResizeState.current.columnKey,
        Math.floor(colResizeState.current.width),
        colResizeState.current.fieldScope
      );
      colResizeState.current = { ...INITIAL_COL_RESIZE_STATE };
    }
    window.removeEventListener('click', dispatchEvent, { capture: true });
  }, [onColumnResize]);

  // this is the callback that gets passed to react-data-grid
  const dataGridResizeHandler = useCallback(
    (column: Column<TableRow, TableSummaryRow>, width: number) => {
      if (!colResizeState.current.columnKey) {
        window.addEventListener('click', dispatchEvent, { capture: true });
      }

      colResizeState.current.columnKey = column.key;
      colResizeState.current.width = width;

      if (fieldScope) {
        colResizeState.current.fieldScope = fieldScope;
      }

      // when double clicking to resize, this handler will fire, but the pointer will not be down,
      // meaning that we should immediately flush the new width
      if (!pointerIsDown.current) {
        dispatchEvent();
      }
    },
    [fieldScope, dispatchEvent]
  );

  return dataGridResizeHandler;
}
