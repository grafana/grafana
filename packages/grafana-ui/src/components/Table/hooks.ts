import { useEffect } from 'react';
import * as React from 'react';
import { VariableSizeList } from 'react-window';

import { DataFrame } from '@grafana/data';

import { GrafanaTableState } from './types';

/**
  To have the custom vertical scrollbar always visible (https://github.com/grafana/grafana/issues/52136),
  we need to bring the element from the VariableSizeList scope to the outer Table container scope,
  because the VariableSizeList scope has overflow. By moving scrollbar to container scope we will have
  it always visible since the entire width is in view.
  Select the scrollbar element from the VariableSizeList scope
 */
export function useFixScrollbarContainer(
  variableSizeListScrollbarRef: React.RefObject<HTMLDivElement>,
  tableDivRef: React.RefObject<HTMLDivElement>
) {
  useEffect(() => {
    if (variableSizeListScrollbarRef.current && tableDivRef.current) {
      const listVerticalScrollbarHTML = variableSizeListScrollbarRef.current.querySelector('.track-vertical');

      // Select Table custom scrollbars
      const tableScrollbarView = tableDivRef.current.firstChild;

      //If they exist, move the scrollbar element to the Table container scope
      if (tableScrollbarView && listVerticalScrollbarHTML) {
        listVerticalScrollbarHTML.remove();
        if (tableScrollbarView instanceof HTMLElement) {
          tableScrollbarView.querySelector(':scope > .track-vertical')?.remove();
          tableScrollbarView.append(listVerticalScrollbarHTML);
        }
      }
    }
  });
}

/**
  react-table caches the height of cells, so we need to reset them when expanding/collapsing rows.
  We use `lastExpandedOrCollapsedIndex` since collapsed rows disappear from `expandedIndexes` but still keep their expanded
  height.
 */
export function useResetVariableListSizeCache(
  extendedState: GrafanaTableState,
  listRef: React.RefObject<VariableSizeList>,
  data: DataFrame,
  hasUniqueId: boolean
) {
  // Make sure we trigger the reset when keys change in any way
  const expandedRowsRepr = JSON.stringify(Object.keys(extendedState.expanded));

  useEffect(() => {
    // By default, reset all rows
    let resetIndex = 0;

    // If we have unique field, extendedState.expanded keys are not row indexes but IDs so instead of trying to search
    // for correct index we just reset the whole table.
    if (!hasUniqueId) {
      // If we don't have we reset from the last changed index.
      if (Number.isFinite(extendedState.lastExpandedOrCollapsedIndex)) {
        resetIndex = extendedState.lastExpandedOrCollapsedIndex!;
      }

      // Account for paging.
      resetIndex =
        extendedState.pageIndex === 0
          ? resetIndex - 1
          : resetIndex - extendedState.pageIndex - extendedState.pageIndex * extendedState.pageSize;
    }

    listRef.current?.resetAfterIndex(Math.max(resetIndex, 0));
    return;
  }, [
    extendedState.lastExpandedOrCollapsedIndex,
    extendedState.pageSize,
    extendedState.pageIndex,
    listRef,
    data,
    expandedRowsRepr,
    hasUniqueId,
  ]);
}
