import { useCallback } from 'react';

import { getFieldDisplayName } from '@grafana/data';

import {
  TableSortByFieldState,
  GrafanaTableColumn,
  GrafanaTableState,
  TableStateReducerProps,
  TableRTProps,
} from './types';

export interface ActionType {
  type: string;
  id: string | undefined;
}

export function useTableStateReducer({ onColumnResize, onSortByChange, data }: TableStateReducerProps) {
  return useCallback(
    (newState: GrafanaTableState, action: ActionType) => {
      switch (action.type) {
        case 'columnDoneResizing':
          if (onColumnResize) {
            const info = (newState.columnResizing?.headerIdWidths as any)?.[0];
            const columnIdString = info?.[0];
            const fieldIndex = parseInt(columnIdString, 10);
            const width = Math.round(newState.columnResizing.columnWidths?.[columnIdString]);

            const field = data.fields?.[fieldIndex];
            if (!field) {
              return newState;
            }

            const fieldDisplayName = getFieldDisplayName(field, data);
            onColumnResize(fieldDisplayName, width);
          }
        case 'toggleSortBy':
          if (onSortByChange) {
            const sortByFields: TableSortByFieldState[] = [];

            for (const sortItem of newState.sortBy) {
              const field = data.fields[parseInt(sortItem.id, 10)];
              if (!field) {
                continue;
              }

              sortByFields.push({
                displayName: getFieldDisplayName(field, data),
                desc: sortItem.desc,
              });
            }

            onSortByChange(sortByFields);
          }
        case 'toggleRowExpanded': {
          if (action.id) {
            return {
              ...newState,
              lastExpandedOrCollapsedIndex: parseInt(action.id, 10),
            };
          }
        }
      }

      return newState;
    },
    [data, onColumnResize, onSortByChange]
  );
}

export function getInitialState(
  initialSortBy: TableRTProps['initialSortBy'],
  columns: GrafanaTableColumn[]
): Partial<GrafanaTableState> {
  const state: Partial<GrafanaTableState> = {};

  if (initialSortBy) {
    state.sortBy = [];

    for (const sortBy of initialSortBy) {
      for (const col of columns) {
        if (col.Header === sortBy.displayName) {
          state.sortBy.push({ id: col.id!, desc: sortBy.desc });
        }
      }
    }
  }

  return state;
}
