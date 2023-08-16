import debounce from 'debounce-promise';
import { useEffect, useRef, useState } from 'react';

import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service';

import { CommandPaletteAction } from '../types';
import { RECENT_DASHBOARDS_PRORITY, SEARCH_RESULTS_PRORITY } from '../values';

const MAX_SEARCH_RESULTS = 100;
const MAX_RECENT_DASHBOARDS = 5;

const debouncedSearch = debounce(getSearchResultActions, 200);

export async function getRecentDashboardActions(): Promise<CommandPaletteAction[]> {
  if (!contextSrv.user.isSignedIn) {
    return [];
  }

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
      id: `recent-dashboards${url}`,
      name: `${name}`,
      section: t('command-palette.section.recent-dashboards', 'Recent dashboards'),
      priority: RECENT_DASHBOARDS_PRORITY,
      url,
    };
  });

  return recentDashboardActions;
}

export async function getSearchResultActions(searchQuery: string): Promise<CommandPaletteAction[]> {
  // Empty strings should not come through to here
  if (searchQuery.length === 0 || (!contextSrv.user.isSignedIn && !config.bootData.settings.anonymousEnabled)) {
    return [];
  }

  const data = await getGrafanaSearcher().search({
    kind: ['dashboard', 'folder'],
    query: searchQuery,
    limit: MAX_SEARCH_RESULTS,
  });

  const goToSearchResultActions: CommandPaletteAction[] = data.view.map((item) => {
    const { url, name, kind, location } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      id: `go/${kind}${url}`,
      name: `${name}`,
      section:
        kind === 'dashboard'
          ? t('command-palette.section.dashboard-search-results', 'Dashboards')
          : t('command-palette.section.folder-search-results', 'Folders'),
      priority: SEARCH_RESULTS_PRORITY,
      url,
      subtitle: data.view.dataFrame.meta?.custom?.locationInfo[location]?.name,
    };
  });

  return goToSearchResultActions;
}

export function useSearchResults(searchQuery: string, isShowing: boolean) {
  const [searchResults, setSearchResults] = useState<CommandPaletteAction[]>([]);
  const [isFetchingSearchResults, setIsFetchingSearchResults] = useState(false);
  const lastSearchTimestamp = useRef<number>(0);

  // Hit dashboards API
  useEffect(() => {
    const timestamp = Date.now();
    if (isShowing && searchQuery.length > 0) {
      setIsFetchingSearchResults(true);
      debouncedSearch(searchQuery).then((resultActions) => {
        // Only keep the results if it's was issued after the most recently resolved search.
        // This prevents results showing out of order if first request is slower than later ones.
        // We don't need to worry about clearing the isFetching state either - if there's a later
        // request in progress, this will clear it for us
        if (timestamp > lastSearchTimestamp.current) {
          setSearchResults(resultActions);
          setIsFetchingSearchResults(false);
          lastSearchTimestamp.current = timestamp;
        }
      });
    } else {
      setSearchResults([]);
      setIsFetchingSearchResults(false);
      lastSearchTimestamp.current = timestamp;
    }
  }, [isShowing, searchQuery]);

  return {
    searchResults,
    isFetchingSearchResults,
  };
}
