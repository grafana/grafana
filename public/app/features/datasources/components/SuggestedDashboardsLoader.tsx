import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { config, getDataSourceSrv } from '@grafana/runtime';
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
  dataSource: { uid: string; type: string; typeName: string };
  fetchOnMount?: boolean;
  onFetchComplete?: (hasDashboards: boolean) => void;
  children: (props: SuggestedDashboardsLoaderChildProps) => ReactNode;
}

export const SuggestedDashboardsLoader = ({
  dataSource,
  fetchOnMount,
  onFetchComplete,
  children,
}: SuggestedDashboardsLoaderProps) => {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [provisionedDashboards, setProvisionedDashboards] = useState<PluginDashboard[]>([]);
  const [communityDashboards, setCommunityDashboards] = useState<GnetDashboard[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  const triggerFetch = useCallback(async () => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    setFetchStatus('loading');

    try {
      const ds = getDataSourceSrv().getInstanceSettings(dataSource.uid);
      if (!ds) {
        setFetchStatus('done');
        onFetchComplete?.(false);
        return;
      }

      const [provisioned, communityResponse] = await Promise.all([
        fetchProvisionedDashboards(ds.type),
        config.featureToggles.suggestedDashboards && config.featureToggles.dashboardLibrary
          ? fetchCommunityDashboards({
              orderBy: 'downloads',
              direction: 'desc',
              page: 1,
              pageSize: 10,
              includeScreenshots: true,
              dataSourceSlugIn: ds.type,
              includeLogo: true,
            })
          : Promise.resolve({ items: [] }),
      ]);

      setProvisionedDashboards(provisioned);
      setCommunityDashboards(communityResponse.items);
      setFetchStatus('done');
      onFetchComplete?.(provisioned.length > 0 || communityResponse.items.length > 0);
    } catch {
      setFetchStatus('error');
    }
  }, [dataSource.uid, onFetchComplete]);

  useEffect(() => {
    if (fetchOnMount) {
      triggerFetch();
    }
  }, [fetchOnMount, triggerFetch]);

  const hasDashboards = provisionedDashboards.length > 0 || communityDashboards.length > 0;
  const openModal = useCallback(() => setIsOpen(true), []);

  return (
    <>
      {children({ fetchStatus, hasDashboards, triggerFetch, openModal })}
      <SuggestedDashboardsModal
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        datasourceUid={dataSource.uid}
        provisionedDashboards={fetchStatus === 'done' ? provisionedDashboards : undefined}
        communityDashboards={fetchStatus === 'done' ? communityDashboards : undefined}
      />
    </>
  );
};
