import { useEffect, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { type NavModelItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDashboardSnapshotSrv } from 'app/features/dashboard/services/SnapshotSrv';
import { getLibraryPanels } from 'app/features/library-panels/state/api';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

// The Dashboards section's nav id is "dashboards/browse" (navtree.NavIDDashboards), not "dashboards".
export const DASHBOARDS_NAV_ID = 'dashboards/browse';
export const SNAPSHOTS_NAV_ID = 'dashboards/snapshots';
export const LIBRARY_PANELS_NAV_ID = 'dashboards/library-panels';
export const SHARED_DASHBOARDS_NAV_ID = 'dashboards/public';
export const RECENTLY_DELETED_NAV_ID = 'dashboards/recently-deleted';

type DataStatus = 'loading' | 'has-data' | 'empty' | 'error';

// Resolved results persist for the lifetime of the page so re-expanding the Dashboards
// section does not refetch and re-flicker. Newly-created items therefore appear in the
// menu on the next page load rather than instantly — an accepted trade-off for navigation.
const resultCache = new Map<string, boolean>();
const inflightCache = new Map<string, Promise<boolean>>();

// Test-only: reset the session caches between test cases.
export function clearDashboardNavItemDataCache() {
  resultCache.clear();
  inflightCache.clear();
}

function useDataStatus(cacheKey: string, fetcher: () => Promise<boolean>, enabled: boolean): DataStatus {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [status, setStatus] = useState<DataStatus>(() =>
    resultCache.has(cacheKey) ? (resultCache.get(cacheKey) ? 'has-data' : 'empty') : 'loading'
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (resultCache.has(cacheKey)) {
      setStatus(resultCache.get(cacheKey) ? 'has-data' : 'empty');
      return;
    }

    let cancelled = false;
    let promise = inflightCache.get(cacheKey);
    if (!promise) {
      promise = fetcherRef.current();
      inflightCache.set(cacheKey, promise);
    }
    setStatus('loading');
    promise.then(
      (hasData) => {
        resultCache.set(cacheKey, hasData);
        inflightCache.delete(cacheKey);
        if (!cancelled) {
          setStatus(hasData ? 'has-data' : 'empty');
        }
      },
      () => {
        inflightCache.delete(cacheKey);
        if (!cancelled) {
          setStatus('error');
        }
      }
    );

    return () => {
      cancelled = true;
    };
    // fetcherRef is intentionally excluded — it is read via ref to avoid re-running the effect on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return status;
}

async function fetchHasSharedDashboards(): Promise<boolean> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<{ totalCount: number }>({
      method: 'GET',
      url: '/api/dashboards/public-dashboards',
      params: { page: 1, perpage: 1 },
      showErrorAlert: false,
    })
  );
  return response.data.totalCount > 0;
}

/**
 * Returns the set of child nav IDs under "Dashboards" that should be hidden because they
 * have no data. Checks run only when `enabled` (the section is expanded) and only for the
 * Dashboards link. An item is hidden while loading or when confirmed empty, and shown when
 * it has data or when its check errors.
 */
export function useEmptyDashboardNavItems(link: NavModelItem, enabled: boolean): Set<string> {
  const active = enabled && link.id === DASHBOARDS_NAV_ID;

  const snapshots = useDataStatus(
    SNAPSHOTS_NAV_ID,
    () =>
      getDashboardSnapshotSrv()
        .getSnapshots()
        .then((r) => r.length > 0),
    active
  );
  const libraryPanels = useDataStatus(
    LIBRARY_PANELS_NAV_ID,
    () => getLibraryPanels({ perPage: 1 }).then((r) => r.totalCount > 0),
    active
  );
  const sharedDashboards = useDataStatus(SHARED_DASHBOARDS_NAV_ID, fetchHasSharedDashboards, active);
  const recentlyDeleted = useDataStatus(
    RECENTLY_DELETED_NAV_ID,
    () =>
      getGrafanaSearcher()
        .search({ deleted: true, limit: 1 })
        .then((r) => r.totalRows > 0),
    active
  );

  const hidden = new Set<string>();
  if (link.id !== DASHBOARDS_NAV_ID) {
    return hidden;
  }

  const entries: Array<[string, DataStatus]> = [
    [SNAPSHOTS_NAV_ID, snapshots],
    [LIBRARY_PANELS_NAV_ID, libraryPanels],
    [SHARED_DASHBOARDS_NAV_ID, sharedDashboards],
    [RECENTLY_DELETED_NAV_ID, recentlyDeleted],
  ];
  for (const [id, status] of entries) {
    if (status === 'loading' || status === 'empty') {
      hidden.add(id);
    }
  }

  return hidden;
}
