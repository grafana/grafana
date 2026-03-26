import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { SuggestedDashboardsModal } from 'app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal';
import {
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/api/dashboardLibraryApi';
import { GnetDashboard } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import {
  DEFAULT_SORT_ORDER,
  DEFAULT_SORT_DIRECTION,
  COMMUNITY_PAGE_SIZE_QUERY,
  INCLUDE_LOGO,
  INCLUDE_SCREENSHOTS,
  COMMUNITY_RESULT_SIZE,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/communityDashboardHelpers';
import { PluginDashboard } from 'app/types/plugins';

type FetchStatus = 'idle' | 'loading' | 'done' | 'error';

interface DashboardFetchResult {
  provisioned: PluginDashboard[];
  community: GnetDashboard[];
}

// Module-level cache keyed by datasource type — shared across all instances
const dashboardCache = new Map<string, DashboardFetchResult>();
const pendingFetches = new Map<string, Promise<DashboardFetchResult>>();

export interface SuggestedDashboardsLoaderChildProps {
  fetchStatus: FetchStatus;
  hasDashboards: boolean;
  triggerFetch: () => void;
  openModal: () => void;
}

interface SuggestedDashboardsLoaderProps {
  datasourceUid: string;
  fetchOnMount?: boolean;
  onFetchComplete?: (hasDashboards: boolean) => void;
  children: (props: SuggestedDashboardsLoaderChildProps) => ReactNode;
}

export const SuggestedDashboardsLoader = ({
  datasourceUid,
  fetchOnMount,
  onFetchComplete,
  children,
}: SuggestedDashboardsLoaderProps) => {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [provisionedDashboards, setProvisionedDashboards] = useState<PluginDashboard[]>([]);
  const [communityDashboards, setCommunityDashboards] = useState<GnetDashboard[]>([]);
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
            pageSize: COMMUNITY_PAGE_SIZE_QUERY,
            includeLogo: INCLUDE_LOGO,
            includeScreenshots: INCLUDE_SCREENSHOTS,
            dataSourceSlugIn: ds.type,
          }),
        ])
          .then(([provisioned, communityResponse]) => {
            const result: DashboardFetchResult = { provisioned, community: communityResponse.items };
            dashboardCache.set(ds.type, result);
            return result;
          })
          .finally(() => {
            pendingFetches.delete(ds.type);
          });
        pendingFetches.set(ds.type, pending);
      }

      const { provisioned, community } = await pending;
      setProvisionedDashboards(provisioned);
      setCommunityDashboards(community.slice(0, COMMUNITY_RESULT_SIZE));
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

  return (
    <>
      {children({ fetchStatus, hasDashboards, triggerFetch, openModal })}
      <SuggestedDashboardsModal
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        datasourceUid={datasourceUid}
        provisionedDashboards={provisionedDashboards}
        communityDashboards={communityDashboards}
        isDashboardsLoading={fetchStatus === 'loading'}
      />
    </>
  );
};
