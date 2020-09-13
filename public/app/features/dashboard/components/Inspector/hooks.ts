import { DataQueryError, DataSourceApi, PanelData, PanelPlugin } from '@grafana/data';
import useAsync from 'react-use/lib/useAsync';
import { getDataSourceSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';
import { useMemo } from 'react';
import { supportsDataQuery } from '../PanelEditor/utils';
import { InspectTab } from './types';

/**
 * Given PanelData return first data source supporting metadata inspector
 */
export const useDatasourceMetadata = (data?: PanelData) => {
  const state = useAsync<DataSourceApi | undefined>(async () => {
    const targets = data?.request?.targets || [];

    if (data && data.series && targets.length) {
      for (const frame of data.series) {
        if (frame.meta && frame.meta.custom) {
          // get data source from first query
          const dataSource = await getDataSourceSrv().get(targets[0].datasource);
          if (dataSource && dataSource.components?.MetadataInspector) {
            return dataSource;
          }
        }
      }
    }

    return undefined;
  }, [data]);
  return state.value;
};

/**
 * Configures tabs for PanelInspector
 */
export const useInspectTabs = (
  plugin: PanelPlugin,
  dashboard: DashboardModel,
  error?: DataQueryError,
  metaDs?: DataSourceApi
) => {
  return useMemo(() => {
    const tabs = [];
    if (supportsDataQuery(plugin)) {
      tabs.push({ label: 'Data', value: InspectTab.Data });
      tabs.push({ label: 'Stats', value: InspectTab.Stats });
    }

    if (metaDs) {
      tabs.push({ label: 'Meta Data', value: InspectTab.Meta });
    }

    tabs.push({ label: 'JSON', value: InspectTab.JSON });

    if (error && error.message) {
      tabs.push({ label: 'Error', value: InspectTab.Error });
    }

    if (dashboard.meta.canEdit && supportsDataQuery(plugin)) {
      tabs.push({ label: 'Query', value: InspectTab.Query });
    }
    return tabs;
  }, [plugin, metaDs, dashboard, error]);
};
