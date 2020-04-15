import { KeyboardEvent } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { DashboardQuery, DashboardSearchItemType, DashboardSection, SearchReducer } from '../types';
import { MOVE_SELECTION_DOWN, MOVE_SELECTION_UP } from '../reducers/actionTypes';
import { findSelected } from '../utils';
import { useSearch } from './useSearch';
import { DashboardsSearchState } from '../reducers/dashboardSearch';

export const useDashboardSearch = (
  query: DashboardQuery,
  reducer: SearchReducer<DashboardsSearchState>,
  onCloseSearch: () => void
) => {
  const {
    state: { results, loading },
    onToggleSection,
    dispatch,
  } = useSearch<DashboardsSearchState>(query, reducer, true);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Escape':
        onCloseSearch();
        break;
      case 'ArrowUp':
        dispatch({ type: MOVE_SELECTION_UP });
        break;
      case 'ArrowDown':
        dispatch({ type: MOVE_SELECTION_DOWN });
        break;
      case 'Enter':
        const selectedItem = findSelected(results);
        if (selectedItem) {
          if (selectedItem.type === DashboardSearchItemType.DashFolder) {
            onToggleSection(selectedItem as DashboardSection);
          } else {
            getLocationSrv().update({ path: selectedItem.url });
            // Delay closing to prevent current page flicker
            setTimeout(onCloseSearch, 0);
          }
        }
    }
  };

  return {
    results,
    loading,
    onToggleSection,
    onKeyDown,
  };
};
