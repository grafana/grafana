import debounce from 'debounce-promise';
import { useEffect, useState } from 'react';

import { CommandPaletteAction } from '../types';

import { getDashboardSearchResultActions } from './dashboardActions';

const debouncedDashboardSearch = debounce(getDashboardSearchResultActions, 200);

export const useDashboardResults = (searchQuery: string, isShowing: boolean) => {
  const [dashboardResults, setDashboardResults] = useState<CommandPaletteAction[]>([]);

  // Hit dashboards API
  useEffect(() => {
    if (isShowing && searchQuery.length > 0) {
      debouncedDashboardSearch(searchQuery).then((resultActions) => {
        setDashboardResults(resultActions);
      });
    }
  }, [isShowing, searchQuery]);

  return dashboardResults;
};
