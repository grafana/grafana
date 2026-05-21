import { type DataSourceInstanceSettings } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { useQueryDatasource } from './useQueryDatasource';

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
