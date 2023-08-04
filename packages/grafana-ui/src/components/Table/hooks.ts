import React, { useEffect } from 'react';
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
    const listVerticalScrollbarHTML = (variableSizeListScrollbarRef.current as HTMLDivElement)?.querySelector(
      '.track-vertical'
    );

    // Select Table custom scrollbars
    const tableScrollbarView = (tableDivRef.current as HTMLDivElement)?.firstChild;

    //If they exists, move the scrollbar element to the Table container scope
    if (tableScrollbarView && listVerticalScrollbarHTML) {
      listVerticalScrollbarHTML?.remove();
      (tableScrollbarView as HTMLDivElement).querySelector(':scope > .track-vertical')?.remove();

      (tableScrollbarView as HTMLDivElement).append(listVerticalScrollbarHTML as Node);
    }
  });
}

/**
  react-table caches the height of cells so we need to reset them when expanding/collapsing rows
   We need to take the minimum of the current expanded indexes and the previous expandedIndexes array to account
  for collapsed rows, since they disappear from expandedIndexes but still keep their expanded height
 */
export function useResetVariableListSizeCache(
  extendedState: GrafanaTableState,
  listRef: React.RefObject<VariableSizeList>,
  data: DataFrame
) {
  useEffect(() => {
    if (extendedState.lastExpandedIndex !== undefined) {
      // Gets the expanded row with the lowest index. Needed to reset all expanded row heights from that index on
      let resetIndex = extendedState.lastExpandedIndex;
      const expandedIndexes = Object.keys(extendedState.expanded);
      if (expandedIndexes.length > 0) {
        const lowestExpandedIndex = parseInt(expandedIndexes[0], 10);
        if (!isNaN(lowestExpandedIndex)) {
          resetIndex = Math.min(resetIndex, lowestExpandedIndex);
        }
      }

      const index =
        extendedState.pageIndex === 0
          ? resetIndex - 1
          : resetIndex - extendedState.pageIndex - extendedState.pageIndex * extendedState.pageSize;
      listRef.current?.resetAfterIndex(Math.max(index, 0));
      return;
    }
  }, [
    extendedState.lastExpandedIndex,
    extendedState.toggleRowExpandedCounter,
    extendedState.pageIndex,
    extendedState.pageSize,
    listRef,
    data,
    extendedState.expanded,
  ]);
}
