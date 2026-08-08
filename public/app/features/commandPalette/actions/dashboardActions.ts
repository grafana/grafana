import debounce from 'debounce-promise';
import { useEffect, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useFlagGrafanaCmdkHybridSearch, useFlagDashboardVectorSearch } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';
import { isRootFolderUID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type LocationInfo } from 'app/features/search/service/types';
import { toURL } from 'app/features/search/service/unified';
import { extractManagerKind } from 'app/features/search/service/utils';

import { searchDashboardsHybrid } from '../api/hybridSearch';
import { type CommandPaletteAction } from '../types';
import {
  SECTION_DASHBOARDS,
  SECTION_FOLDERS,
  SECTION_RECENT_DASHBOARDS,
  RECENT_DASHBOARDS_PRIORITY,
  SEARCH_RESULTS_PRIORITY,
} from '../values';

const MAX_SEARCH_RESULTS = 100;
// Hybrid search is a top-k API tuned for relevance, not exhaustive listing,
// so keep the dashboard list short
const MAX_HYBRID_SEARCH_RESULTS = 20;
const MAX_RECENT_DASHBOARDS = 5;

const debouncedSearch = debounce(getSearchResultActions, 200);

/**
 * Same as deep search, hybrid search needs vectorSearch flag for the backend.
 */
export function useHybridSearchEnabled(): boolean {
  const hybridSearchFlag = useFlagGrafanaCmdkHybridSearch();
  const vectorSearchFlag = useFlagDashboardVectorSearch();
  return hybridSearchFlag && vectorSearchFlag;
}

export async function getRecentDashboardActions(): Promise<CommandPaletteAction[]> {
  if (!contextSrv.user.isSignedIn) {
    return [];
  }

  const recentResults = await getRecentlyViewedDashboards(MAX_RECENT_DASHBOARDS);

  const recentDashboardActions: CommandPaletteAction[] = recentResults.map((item) => {
    const { url, name, managedBy } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      id: `recent-dashboards${url}`,
      name: `${name}`,
      section: t('command-palette.section.recent-dashboards', 'Recent dashboards'),
      sectionId: SECTION_RECENT_DASHBOARDS,
      priority: RECENT_DASHBOARDS_PRIORITY,
      url,
      managedBy: extractManagerKind(managedBy),
    };
  });

  return recentDashboardActions;
}

export async function getSearchResultActions(
  searchQuery: string,
  useHybridSearch = false
): Promise<CommandPaletteAction[]> {
  // Empty strings should not come through to here
  if (searchQuery.length === 0 || (!contextSrv.user.isSignedIn && !config.anonymousEnabled)) {
    return [];
  }

  if (!useHybridSearch) {
    return getClassicSearchResultActions(searchQuery, ['dashboard', 'folder']);
  }

  // Folders aren't indexed for hybrid search, so they still come from the classic searcher
  const [dashboardActions, folderActions] = await Promise.all([
    getHybridDashboardActions(searchQuery),
    getClassicSearchResultActions(searchQuery, ['folder']),
  ]);

  return [...dashboardActions, ...folderActions];
}

async function getClassicSearchResultActions(
  searchQuery: string,
  kinds: Array<'dashboard' | 'folder'>
): Promise<CommandPaletteAction[]> {
  const data = await getGrafanaSearcher().search({
    kind: kinds,
    query: searchQuery,
    limit: MAX_SEARCH_RESULTS,
  });

  const goToSearchResultActions: CommandPaletteAction[] = data.view.map((item) => {
    const { url, name, kind, location, managedBy } = item; // items are backed by DataFrameView, so must hold the url in a closure
    return {
      id: `go/${kind}${url}`,
      name: `${name}`,
      section:
        kind === 'dashboard'
          ? t('command-palette.section.dashboard-search-results', 'Dashboards')
          : t('command-palette.section.folder-search-results', 'Folders'),
      sectionId: kind === 'dashboard' ? SECTION_DASHBOARDS : SECTION_FOLDERS,
      priority: SEARCH_RESULTS_PRIORITY,
      url,
      subtitle: data.view.dataFrame.meta?.custom?.locationInfo[location]?.name,
      managedBy: extractManagerKind(managedBy),
    };
  });

  return goToSearchResultActions;
}

/**
 * Dashboard search backed by the hybrid (lexical + semantic) endpoint. Falls
 * back to the classic searcher when the request fails, e.g. when the vector
 * backend isn't configured (501) or the endpoint's toggle is off (404).
 */
async function getHybridDashboardActions(searchQuery: string): Promise<CommandPaletteAction[]> {
  let hits;
  try {
    hits = await searchDashboardsHybrid(searchQuery, { limit: MAX_HYBRID_SEARCH_RESULTS });
  } catch (error) {
    console.error('Hybrid dashboard search failed, falling back to the classic search.', error);
    return getClassicSearchResultActions(searchQuery, ['dashboard']);
  }

  // The hybrid endpoint returns the folder UID only; resolve display names
  // through the searcher's cached folder lookup. The folder subtitle is just
  // nice to have, so if the lookup fails show the results without it.
  let locationInfo: Record<string, LocationInfo> = {};
  try {
    locationInfo = await getGrafanaSearcher().getLocationInfo();
  } catch (error) {
    console.error('Failed to load folder info for hybrid search results.', error);
  }

  return hits.map((hit) => {
    const url = toURL(hit.resource, hit.name, hit.title);
    // Root-parented dashboards come back with an empty folder; collapse to the
    // synthetic "general" UID the location lookup uses for root items
    const location = isRootFolderUID(hit.folder) ? 'general' : hit.folder;
    return {
      id: `go/dashboard${url}`,
      name: hit.title,
      section: t('command-palette.section.dashboard-search-results', 'Dashboards'),
      sectionId: SECTION_DASHBOARDS,
      priority: SEARCH_RESULTS_PRIORITY,
      url,
      subtitle: locationInfo[location]?.name,
    };
  });
}

/**
 * Implements actual search logic for dashboards and folders.
 */
export function useSearchResults({ searchQuery, show }: { searchQuery: string; show: boolean }) {
  const [searchResults, setSearchResults] = useState<CommandPaletteAction[]>([]);
  const [isFetchingSearchResults, setIsFetchingSearchResults] = useState(false);
  const lastSearchTimestamp = useRef<number>(0);
  const hybridSearchEnabled = useHybridSearchEnabled();

  // Hit dashboards API
  useEffect(() => {
    const timestamp = Date.now();
    if (show && searchQuery.length > 0) {
      setIsFetchingSearchResults(true);
      debouncedSearch(searchQuery, hybridSearchEnabled).then((resultActions) => {
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
  }, [show, searchQuery, hybridSearchEnabled]);

  return {
    searchResults,
    isFetchingSearchResults,
  };
}
