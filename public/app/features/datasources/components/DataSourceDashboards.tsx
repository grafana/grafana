import React, { useEffect } from 'react';

import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { importDashboard, removeDashboard } from 'app/features/dashboard/state/actions';
import { loadPluginDashboards } from 'app/features/plugins/admin/state/actions';
import { PluginDashboard, StoreState, useDispatch, useSelector } from 'app/types';

import DashboardTable from '../components/DashboardsTable';
import { useLoadDataSource } from '../state';

export type Props = {
  // The UID of the data source
  uid: string;
};

export function DataSourceDashboards({ uid }: Props) {
  useLoadDataSource(uid);

  const dispatch = useDispatch();
  const dataSource = useSelector((s: StoreState) => s.dataSources.dataSource);
  const dashboards = useSelector((s: StoreState) => s.plugins.dashboards);
  const isLoading = useSelector((s: StoreState) => s.plugins.isLoadingPluginDashboards);

  useEffect(() => {
    // Load plugin dashboards only when the datasource has loaded
    if (dataSource.id > 0) {
      dispatch(loadPluginDashboards());
    }
  }, [dispatch, dataSource]);

  const onImportDashboard = (dashboard: PluginDashboard, overwrite: boolean) => {
    dispatch(
      importDashboard(
        {
          pluginId: dashboard.pluginId,
          path: dashboard.path,
          overwrite,
          inputs: [
            {
              name: '*',
              type: 'datasource',
              pluginId: dataSource.type,
              value: dataSource.name,
            },
          ],
        },
        dashboard.title
      )
    );
  };

  const onRemoveDashboard = ({ uid }: PluginDashboard) => {
    dispatch(removeDashboard(uid));
  };

  return (
    <DataSourceDashboardsView
      dashboards={dashboards}
      isLoading={isLoading}
      onImportDashboard={onImportDashboard}
      onRemoveDashboard={onRemoveDashboard}
    />
  );
}

export type ViewProps = {
  isLoading: boolean;
  dashboards: PluginDashboard[];
  onImportDashboard: (dashboard: PluginDashboard, overwrite: boolean) => void;
  onRemoveDashboard: (dashboard: PluginDashboard) => void;
};

export const DataSourceDashboardsView = ({
  isLoading,
  dashboards,
  onImportDashboard,
  onRemoveDashboard,
}: ViewProps) => {
  if (isLoading) {
    return <PageLoader />;
  }

  return <DashboardTable dashboards={dashboards} onImport={onImportDashboard} onRemove={onRemoveDashboard} />;
};
