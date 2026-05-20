import { useAsync } from 'react-use';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

/**
 * Hook to load the datasource for a query.
 * Falls back to the panel's datasource if the query doesn't specify one.
 */
export function useQueryDatasource(query: DataQuery | null, panelDsSettings: DataSourceInstanceSettings | undefined) {
  const { value: queryDsData, loading: queryDsLoading } = useAsync(async () => {
    if (!query) {
      return undefined;
    }

    try {
      // If query has explicit datasource, use it; otherwise fall back to panel datasource
      let dsRef = query.datasource;

      if (!dsRef && panelDsSettings) {
        // Special handling for Mixed datasource:
        // Mixed is a meta-datasource that delegates to per-query datasources. It has no QueryEditor component.
        // Normally, all queries in a Mixed panel should have explicit datasources, but edge cases exist
        // (legacy dashboards, transition states). Fall back to default datasource to allow editing.
        // Matches behavior in resolveNewQueryDatasource.
        if (panelDsSettings.meta.mixed) {
          const defaultDs = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);
          dsRef = defaultDs ? getDataSourceRef(defaultDs) : undefined;
        } else {
          dsRef = getDataSourceRef(panelDsSettings);
        }
      }

      if (!dsRef) {
        return undefined;
      }

      const queryDsSettings = getDataSourceSrv().getInstanceSettings(dsRef);
      if (!queryDsSettings) {
        console.error('Datasource settings not found for', dsRef);
        return undefined;
      }

      const queryDatasource = await getDataSourceSrv().get(dsRef);
      return { datasource: queryDatasource, dsSettings: queryDsSettings };
    } catch (err) {
      console.error('Failed to load datasource for selected query:', err);
      return undefined;
    }
  }, [
    query?.refId,
    query?.datasource?.uid,
    query?.datasource?.type,
    panelDsSettings?.uid,
    panelDsSettings?.meta.mixed,
  ]);

  return {
    queryDsData: queryDsData ?? null,
    queryDsLoading,
  };
}

/**
 * Hook to load the datasource for the currently selected query.
 * Falls back to the panel's datasource if the query doesn't specify one.
 */
export function useSelectedQueryDatasource(
  selectedQuery: DataQuery | null,
  panelDsSettings: DataSourceInstanceSettings | undefined
) {
  const { queryDsData, queryDsLoading } = useQueryDatasource(selectedQuery, panelDsSettings);

  return {
    selectedQueryDsData: queryDsData,
    selectedQueryDsLoading: queryDsLoading,
  };
}
