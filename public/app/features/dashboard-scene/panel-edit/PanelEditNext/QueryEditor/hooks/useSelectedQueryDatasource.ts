import { type DataSourceInstanceSettings } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { useQueryDatasource } from './useQueryDatasource';

/**
 * Hook to load the datasource for the currently selected query.
 * Falls back to the panel's datasource if the query doesn't specify one.
 *
 * `panel` is forwarded so section-scoped (row/tab) datasource variables resolve.
 */
export function useSelectedQueryDatasource(
  selectedQuery: DataQuery | null,
  panelDsSettings: DataSourceInstanceSettings | undefined,
  panel?: VizPanel
) {
  const { queryDsData, queryDsLoading } = useQueryDatasource(selectedQuery, panelDsSettings, panel);

  return {
    selectedQueryDsData: queryDsData,
    selectedQueryDsLoading: queryDsLoading,
  };
}
