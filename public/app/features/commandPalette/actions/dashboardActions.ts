import debounce from 'debounce-promise';
import { useEffect, useState } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service';

import { CommandPaletteAction } from '../types';
import { RECENT_DASHBOARDS_PRORITY, SEARCH_RESULTS_PRORITY } from '../values';

const MAX_SEARCH_RESULTS = 100;
const MAX_RECENT_DASHBOARDS = 5;

const debouncedDashboardSearch = debounce(getDashboardSearchResultActions, 200);

export async function getRecentDashboardActions(): Promise<CommandPaletteAction[]> {
  const recentUids = (await impressionSrv.getDashboardOpened()).slice(0, MAX_RECENT_DASHBOARDS);
  const resultsDataFrame = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    limit: MAX_RECENT_DASHBOARDS,
    uid: recentUids,
  });

  // Search results are alphabetical, so reorder them according to recently viewed
  const recentResults = resultsDataFrame.view.toArray();
  recentResults.sort((resultA, resultB) => {
    const orderA = recentUids.indexOf(resultA.uid);
    const orderB = recentUids.indexOf(resultB.uid);
    return orderA - orderB;
  });

  const recentDashboardActions: CommandPaletteAction[] = recentResults.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      id: `recent-dashboards/${url}`,
      name: `${name}`,
      section: t('command-palette.section.recent-dashboards', 'Recent dashboards'),
      priority: RECENT_DASHBOARDS_PRORITY,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  return recentDashboardActions;
}

export async function getDashboardSearchResultActions(searchQuery: string): Promise<CommandPaletteAction[]> {
  // Empty strings should not come through to here
  if (searchQuery.length === 0) {
    return [];
  }

  const data = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    query: searchQuery,
    limit: MAX_SEARCH_RESULTS,
  });

  const goToDashboardActions: CommandPaletteAction[] = data.view.map((item) => {
    const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      id: `go/dashboard/${url}`,
      name: `${name}`,
      section: t('command-palette.section.dashboard-search-results', 'Dashboards'),
      priority: SEARCH_RESULTS_PRORITY,
      perform: () => {
        locationService.push(locationUtil.stripBaseFromUrl(url));
      },
    };
  });

  return goToDashboardActions;
}

export function useDashboardResults(searchQuery: string, isShowing: boolean) {
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
}
