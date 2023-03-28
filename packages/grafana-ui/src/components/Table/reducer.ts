import { useCallback } from 'react';

import { getFieldDisplayName } from '@grafana/data';

import { TableSortByFieldState, GrafanaTableColumn, GrafanaTableState, Props } from './types';

export interface ActionType {
  type: string;
  id: string | undefined;
}

export function useTableStateReducer({ onColumnResize, onSortByChange, data }: Props) {
  return useCallback(
    (newState: GrafanaTableState, action: ActionType) => {
      switch (action.type) {
        case 'columnDoneResizing':
          if (onColumnResize) {
            const info = (newState.columnResizing.headerIdWidths as any)[0];
            const columnIdString = info[0];
            const fieldIndex = getSourceDataFieldIndex(columnIdString, newState);
            // Can't resize row number column
            if (fieldIndex < 0) {
              return newState;
            }

            const width = Math.round(newState.columnResizing.columnWidths[columnIdString] as number);

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
              const fieldIndex = getSourceDataFieldIndex(sortItem.id, newState);
              // Can't resize row number column
              if (fieldIndex < 0) {
                return newState;
              }

              const field = data.fields[fieldIndex];
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
              lastExpandedIndex: parseInt(action.id, 10),
              toggleRowExpandedCounter: newState.toggleRowExpandedCounter + 1,
            };
          }
        }
      }

      return newState;
    },
    [data, onColumnResize, onSortByChange]
  );
}

function getSourceDataFieldIndex(columnId: string, state: GrafanaTableState) {
  const fieldIndex = parseInt(columnId, 10);
  return state.showRowNums ? fieldIndex - 1 : fieldIndex;
}

export function getInitialState(
  initialSortBy: Props['initialSortBy'],
  showRowNums: boolean | undefined,
  columns: GrafanaTableColumn[]
): Partial<GrafanaTableState> {
  const state: Partial<GrafanaTableState> = {
    toggleRowExpandedCounter: 0,
    showRowNums,
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
