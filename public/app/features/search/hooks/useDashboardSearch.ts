import { KeyboardEvent, useReducer } from 'react';
import { useDebounce } from 'react-use';

import { dashboardsSearchState, DashboardsSearchState, searchReducer } from '../reducers/dashboardSearch';
import { DashboardQuery } from '../types';

import { reportDashboardListViewed } from './useManageDashboards';
import { useSearch } from './useSearch';
import { useShowDashboardPreviews } from './useShowDashboardPreviews';

export const useDashboardSearch = (query: DashboardQuery, onCloseSearch: () => void) => {
  const reducer = useReducer(searchReducer, dashboardsSearchState);
  const { showPreviews, setShowPreviews, previewFeatureEnabled } = useShowDashboardPreviews();
  const {
    state: { results, loading },
    onToggleSection,
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
