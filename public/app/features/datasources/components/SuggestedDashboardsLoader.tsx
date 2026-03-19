import { type ReactNode, useCallback, useRef, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { SuggestedDashboardsModal } from 'app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal';
import {
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/api/dashboardLibraryApi';
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
          pageSize: 10,
          includeScreenshots: true,
          dataSourceSlugIn: ds.type,
          includeLogo: true,
        }),
      ]);

      setProvisionedDashboards(provisioned);
      setCommunityDashboards(communityResponse.items);
      setFetchStatus('done');
      onFetchComplete?.(provisioned.length > 0 || communityResponse.items.length > 0);
    } catch {
      setFetchStatus('error');
    }
  }, [datasourceUid, onFetchComplete]);

  if (fetchOnMount && !hasFetchedRef.current) {
    triggerFetch();
  }

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
