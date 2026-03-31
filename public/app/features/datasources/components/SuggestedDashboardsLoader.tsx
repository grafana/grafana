import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { SuggestedDashboardsModal } from 'app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal';
import { TrackingProvider } from 'app/features/dashboard/dashgrid/DashboardLibrary/TrackingContext';
import {
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/api/dashboardLibraryApi';
import {
  EVENT_LOCATIONS,
  PAGE_SIZE,
  type SourceEntryPoint,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { type GnetDashboard } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import {
  DEFAULT_SORT_ORDER,
  DEFAULT_SORT_DIRECTION,
  INCLUDE_LOGO,
  INCLUDE_SCREENSHOTS,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/communityDashboardHelpers';
import { type PluginDashboard } from 'app/types/plugins';

type FetchStatus = 'idle' | 'loading' | 'done' | 'error';

interface DashboardFetchResult {
  provisioned: PluginDashboard[];
  community: GnetDashboard[];
  communityTotalPages: number;
  lastPageItemCount?: number;
}

// Module-level cache keyed by datasource type — shared across all instances
const dashboardCache = new Map<string, DashboardFetchResult>();
const pendingFetches = new Map<string, Promise<DashboardFetchResult>>();

/** Visible for testing only — clears the module-level dashboard cache */
export function clearDashboardCache() {
  dashboardCache.clear();
  pendingFetches.clear();
}

export interface SuggestedDashboardsLoaderChildProps {
  fetchStatus: FetchStatus;
  hasDashboards: boolean;
  triggerFetch: () => void;
  openModal: () => void;
}

interface SuggestedDashboardsLoaderProps {
  datasourceUid: string;
  sourceEntryPoint: SourceEntryPoint;
  fetchOnMount?: boolean;
  onFetchComplete?: (hasDashboards: boolean) => void;
  children: (props: SuggestedDashboardsLoaderChildProps) => ReactNode;
}

export const SuggestedDashboardsLoader = ({
  datasourceUid,
  sourceEntryPoint,
  fetchOnMount,
  onFetchComplete,
  children,
}: SuggestedDashboardsLoaderProps) => {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [provisionedDashboards, setProvisionedDashboards] = useState<PluginDashboard[]>([]);
  const [communityDashboards, setCommunityDashboards] = useState<GnetDashboard[]>([]);
  const [communityTotalPages, setCommunityTotalPages] = useState(0);
  const [lastPageItemCount, setLastPageItemCount] = useState<number | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  const hasDashboards = (provisionedDashboards?.length ?? 0) > 0 || (communityDashboards?.length ?? 0) > 0;
  //extract dependency
  const onFetchCompletedRef = useRef<((hasDashboards: boolean) => void) | undefined>(undefined);
  onFetchCompletedRef.current = onFetchComplete;

  const triggerFetch = useCallback(async () => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    setFetchStatus('loading');

    try {
      const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
      if (!ds) {
        setFetchStatus('done');
        onFetchCompletedRef.current?.(false);
        return;
      }

      const cached = dashboardCache.get(ds.type);
      if (cached) {
        setProvisionedDashboards(cached.provisioned);
        setCommunityDashboards(cached.community);
        setCommunityTotalPages(cached.communityTotalPages);
        setLastPageItemCount(cached.lastPageItemCount);
        setFetchStatus('done');
        onFetchCompletedRef.current?.(cached.provisioned.length > 0 || cached.community.length > 0);
        return;
      }

      let pending = pendingFetches.get(ds.type);
      if (!pending) {
        pending = Promise.all([
          fetchProvisionedDashboards(ds.type),
          fetchCommunityDashboards({
            orderBy: DEFAULT_SORT_ORDER,
            direction: DEFAULT_SORT_DIRECTION,
            page: 1,
            pageSize: PAGE_SIZE,
            includeLogo: INCLUDE_LOGO,
            includeScreenshots: INCLUDE_SCREENSHOTS,
            dataSourceSlugIn: ds.type,
          }),
        ])
          .then(([provisioned, communityResponse]) => {
            const result: DashboardFetchResult = {
              provisioned,
              community: communityResponse.items,
              communityTotalPages: communityResponse.pages,
            };
            dashboardCache.set(ds.type, result);
            setCommunityTotalPages(communityResponse.pages);
            return result;
          })
          .finally(() => {
            pendingFetches.delete(ds.type);
          });
        pendingFetches.set(ds.type, pending);
      }

      const { provisioned, community, communityTotalPages: totalPages } = await pending;
      setProvisionedDashboards(provisioned);
      setCommunityDashboards(community);
      setCommunityTotalPages(totalPages);
      setFetchStatus('done');
      onFetchCompletedRef.current?.(provisioned.length > 0 || community.length > 0);
    } catch {
      setFetchStatus('error');
    }
  }, [datasourceUid]);

  useEffect(() => {
    if (fetchOnMount) {
      triggerFetch();
    }
  }, [fetchOnMount, triggerFetch]);

  const openModal = useCallback(() => {
    triggerFetch();
    setIsOpen(true);
  }, [triggerFetch]);

  const handleLastPageItemCount = useCallback(
    (count: number) => {
      setLastPageItemCount(count);
      // Persist in the module-level cache so it survives modal close/reopen
      const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
      if (ds) {
        const cached = dashboardCache.get(ds.type);
        if (cached) {
          cached.lastPageItemCount = count;
        }
      }
    },
    [datasourceUid]
  );

  const trackingValue = useMemo(
    () => ({ sourceEntryPoint, eventLocation: EVENT_LOCATIONS.MODAL_VIEW }),
    [sourceEntryPoint]
  );

  return (
    <>
      {children({ fetchStatus, hasDashboards, triggerFetch, openModal })}
      <TrackingProvider value={trackingValue}>
        <SuggestedDashboardsModal
          isOpen={isOpen}
          onDismiss={() => setIsOpen(false)}
          datasourceUid={datasourceUid}
          provisionedDashboards={provisionedDashboards}
          communityDashboards={communityDashboards}
          communityTotalPages={communityTotalPages}
          lastPageItemCount={lastPageItemCount}
          onLastPageItemCount={handleLastPageItemCount}
          isDashboardsLoading={fetchStatus === 'loading'}
        />
      </TrackingProvider>
    </>
  );
};
