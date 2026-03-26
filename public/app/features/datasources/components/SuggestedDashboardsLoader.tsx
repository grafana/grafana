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
  SourceEntryPoint,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { GnetDashboard } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { PluginDashboard } from 'app/types/plugins';

type FetchStatus = 'idle' | 'loading' | 'done' | 'error';

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
  const [isOpen, setIsOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  const hasDashboards = (provisionedDashboards?.length ?? 0) > 0 || (communityDashboards?.length ?? 0) > 0;

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
        onFetchComplete?.(false);
        return;
      }

      const [provisioned, communityResponse] = await Promise.all([
        fetchProvisionedDashboards(ds.type),
        fetchCommunityDashboards({
          orderBy: 'downloads',
          direction: 'desc',
          page: 1,
          pageSize: PAGE_SIZE,
          includeScreenshots: true,
          dataSourceSlugIn: ds.type,
          includeLogo: true,
        }),
      ]);

      setProvisionedDashboards(provisioned);
      setCommunityDashboards(communityResponse.items);
      setCommunityTotalPages(communityResponse.pages);
      setFetchStatus('done');
      onFetchComplete?.(provisioned.length > 0 || communityResponse.items.length > 0);
    } catch {
      setFetchStatus('error');
    }
  }, [datasourceUid, onFetchComplete]);

  useEffect(() => {
    if (fetchOnMount) {
      triggerFetch();
    }
  }, [fetchOnMount, triggerFetch]);

  const openModal = useCallback(() => {
    triggerFetch();
    setIsOpen(true);
  }, [triggerFetch]);

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
          isDashboardsLoading={fetchStatus === 'loading'}
        />
      </TrackingProvider>
    </>
  );
};
