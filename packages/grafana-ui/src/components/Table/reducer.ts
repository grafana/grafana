import { useCallback } from 'react';

import { DataFrame, getFieldDisplayName } from '@grafana/data';

import {
  TableSortByFieldState,
  GrafanaTableColumn,
  GrafanaTableState,
  Props,
  TableColumnResizeActionCallback,
  TableSortByActionCallback,
} from './types';

export interface ActionType {
  type: string;
  id: string | undefined;
}

interface TableStateReducerProps {
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  toggleAllRowsExpanded: (x: boolean) => void; // TODO;
  data: DataFrame;
}

export function useTableStateReducer({
  onColumnResize,
  onSortByChange,
  toggleAllRowsExpanded,
  data,
}: TableStateReducerProps) {
  return useCallback(
    (newState: GrafanaTableState, action: ActionType) => {
      switch (action.type) {
        case 'columnDoneResizing':
          if (onColumnResize) {
            const info = (newState.columnResizing.headerIdWidths as any)[0];
            const columnIdString = info[0];
            const fieldIndex = parseInt(columnIdString, 10);
            const width = Math.round(newState.columnResizing.columnWidths[columnIdString]);

            const field = data.fields[fieldIndex];
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
          toggleAllRowsExpanded(false);
          console.log('toggleSortBy', newState, action);
          return {
            ...newState,
            lastExpandedIndex: 0,
            toggleRowExpandedCounter: 0,
          };
        case 'toggleRowExpanded': {
          if (action.id) {
            return {
              ...newState,
              lastExpandedIndex: parseInt(action.id, 10),
              toggleRowExpandedCounter: newState.toggleRowExpandedCounter + 1,
            };
          }
        }
      }

      return newState;
    },
    [data, onColumnResize, onSortByChange, toggleAllRowsExpanded]
  );
}

export function getInitialState(
  initialSortBy: Props['initialSortBy'],
  columns: GrafanaTableColumn[]
): Partial<GrafanaTableState> {
  const state: Partial<GrafanaTableState> = {
    toggleRowExpandedCounter: 0,
  };

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
