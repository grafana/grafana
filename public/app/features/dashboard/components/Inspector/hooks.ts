import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { DataSourceApi, PanelData, PanelPlugin } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { InspectTab } from 'app/features/inspector/types';

import { supportsDataQuery } from '../PanelEditor/utils';

/**
 * Given PanelData return first data source supporting metadata inspector
 */
export const useDatasourceMetadata = (data?: PanelData) => {
  const state = useAsync(async () => getDataSourceWithInspector(data), [data]);
  return state.value;
};

export async function getDataSourceWithInspector(data?: PanelData): Promise<DataSourceApi | undefined> {
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
}

/**
 * Configures tabs for PanelInspector
 */
export const useInspectTabs = (
  panel: PanelModel,
  dashboard: DashboardModel,
  plugin: PanelPlugin | undefined | null,
  hasError?: boolean,
  metaDs?: DataSourceApi
) => {
  return useMemo(() => {
    const tabs = [];
    if (supportsDataQuery(plugin)) {
      tabs.push({ label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data });
      tabs.push({ label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats });
    }

    if (metaDs) {
      tabs.push({ label: t('dashboard.inspect.meta-tab', 'Meta data'), value: InspectTab.Meta });
    }

    tabs.push({ label: t('dashboard.inspect.json-tab', 'JSON'), value: InspectTab.JSON });

    if (hasError) {
      tabs.push({ label: t('dashboard.inspect.error-tab', 'Error'), value: InspectTab.Error });
    }

    if (dashboard.meta.canEdit && supportsDataQuery(plugin)) {
      tabs.push({ label: t('dashboard.inspect.query-tab', 'Query'), value: InspectTab.Query });
    }
    return tabs;
  }, [plugin, metaDs, dashboard, hasError]);
};
