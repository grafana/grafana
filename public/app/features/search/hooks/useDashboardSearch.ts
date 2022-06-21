import { KeyboardEvent, useReducer } from 'react';
import { useDebounce } from 'react-use';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { MOVE_SELECTION_DOWN, MOVE_SELECTION_UP } from '../reducers/actionTypes';
import { dashboardsSearchState, DashboardsSearchState, searchReducer } from '../reducers/dashboardSearch';
import { DashboardQuery, DashboardSearchItemType, DashboardSection } from '../types';
import { findSelected } from '../utils';

import { reportDashboardListViewed } from './useManageDashboards';
import { useSearch } from './useSearch';
import { useShowDashboardPreviews } from './useShowDashboardPreviews';

export const useDashboardSearch = (query: DashboardQuery, onCloseSearch: () => void) => {
  const reducer = useReducer(searchReducer, dashboardsSearchState);
  const { showPreviews, setShowPreviews, previewFeatureEnabled } = useShowDashboardPreviews();
  const {
    state: { results, loading },
    onToggleSection,
    dispatch,
  } = useSearch<DashboardsSearchState>(query, reducer, { queryParsing: true });

  useDebounce(
    () => {
      reportDashboardListViewed('dashboard_search', showPreviews, previewFeatureEnabled, {
        layout: query.layout,
        starred: query.starred,
        sortValue: query.sort?.value,
        query: query.query,
        tagCount: query.tag?.length,
      });
    },
    1000,
    [
      showPreviews,
      previewFeatureEnabled,
      query.layout,
      query.starred,
      query.sort?.value,
      query.query?.length,
      query.tag?.length,
    ]
  );

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
            locationService.push(locationUtil.stripBaseFromUrl(selectedItem.url));
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
    showPreviews,
    setShowPreviews,
  };
};
