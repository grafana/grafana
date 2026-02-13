import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

/**
 * Hook to load the datasource for the currently selected query.
 * Falls back to the panel's datasource if the query doesn't specify one.
 */
export function useSelectedQueryDatasource(
  selectedQuery: DataQuery | null,
  panelDsSettings: DataSourceInstanceSettings | undefined
) {
  const { value: selectedQueryDsData, loading: selectedQueryDsLoading } = useAsync(async () => {
    if (!selectedQuery) {
      return undefined;
    }

    try {
      // If query has datasource, use it; otherwise fall back to panel datasource
      const dsRef = selectedQuery.datasource || (panelDsSettings ? getDataSourceRef(panelDsSettings) : undefined);

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
  }, [selectedQuery?.datasource?.uid, selectedQuery?.datasource?.type, panelDsSettings?.uid]);

  return {
    selectedQueryDsData: selectedQueryDsData ?? null,
    selectedQueryDsLoading,
  };
}
