import { extend } from 'lodash';
import { memo, useCallback, useEffect, useState } from 'react';

import { AppEvents, PluginMeta, DataSourceApi } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import DashboardsTable from 'app/features/datasources/components/DashboardsTable';
import { PluginDashboard } from 'app/types/plugins';

interface Props {
  plugin: PluginMeta;
  datasource?: DataSourceApi;
}

export const PluginDashboards = memo(function PluginDashboards({ plugin, datasource }: Props) {
  const [dashboards, setDashboards] = useState<PluginDashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBackendSrv()
      .get(`/api/plugins/${plugin.id}/dashboards`)
      .then((dashboards) => {
        setDashboards(dashboards);
        setLoading(false);
      });
  }, [plugin.id]);

  const importDashboard = useCallback(
    (dash: PluginDashboard, overwrite: boolean) => {
      const installCmd = {
        pluginId: plugin.id,
        path: dash.path,
        overwrite: overwrite,
        inputs: datasource
          ? [
              {
                name: '*',
                type: 'datasource',
                pluginId: datasource.meta.id,
                value: datasource.name,
              },
            ]
          : [],
      };

      return getBackendSrv()
        .post(`/api/dashboards/import`, installCmd)
        .then((res: PluginDashboard) => {
          appEvents.emit(AppEvents.alertSuccess, ['Dashboard Imported', dash.title]);
          extend(dash, res);
          setDashboards((prev) => [...prev]);
        });
    },
    [plugin.id, datasource]
  );

  const remove = useCallback((dash: PluginDashboard) => {
    getBackendSrv()
      .delete('/api/dashboards/uid/' + dash.uid)
      .then(() => {
        dash.imported = false;
        setDashboards((prev) => [...prev]);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <Trans i18nKey="plugins.plugin-dashboards.loading">Loading...</Trans>
      </div>
    );
  }
  if (!dashboards || !dashboards.length) {
    return (
      <div>
        <Trans i18nKey="plugins.plugin-dashboards.dashboards-included-plugin">
          No dashboards are included with this plugin
        </Trans>
      </div>
    );
  }

  return <DashboardsTable dashboards={dashboards} onImport={importDashboard} onRemove={remove} />;
});
