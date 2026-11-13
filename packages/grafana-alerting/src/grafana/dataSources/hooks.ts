import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

import { MANAGING_ALERTS_FILTERS, RECORDING_TARGET_FILTERS } from './narrowings';
import { RULES_SOURCE_LIST_FILTERS, type RulesSourceDataSource, toRulesSourceDataSources } from './rulesSources';

export interface DataSourcesWithValidRecordingTargetResult {
  items: DataSourceInstanceListItem[];
  isLoading: boolean;
  error?: Error;
}

export function useDataSourcesWithValidRecordingTarget(): DataSourcesWithValidRecordingTargetResult {
  const { items, isLoading, error } = useDataSourceInstanceList(RECORDING_TARGET_FILTERS);

  return { items, isLoading, error };
}

export interface DataSourcesWithValidRecordingTargetByUidResult {
  byUid: Map<string, DataSourceInstanceListItem>;
  isLoading: boolean;
  error?: Error;
}

export function useDataSourcesWithValidRecordingTargetByUid(): DataSourcesWithValidRecordingTargetByUidResult {
  const { items, isLoading, error } = useDataSourcesWithValidRecordingTarget();

  return useMemo(
    () => ({ byUid: new Map(items.map((ds) => [ds.uid, ds])), isLoading, error }),
    [items, isLoading, error]
  );
}

export interface DataSourcesManagingAlertsByUidResult {
  byUid: Map<string, DataSourceInstanceListItem>;
  isLoading: boolean;
  error?: Error;
}

export function useDataSourcesManagingAlertsByUid(): DataSourcesManagingAlertsByUidResult {
  const { items, isLoading, error } = useDataSourceInstanceList(MANAGING_ALERTS_FILTERS);

  return useMemo(
    () => ({ byUid: new Map(items.map((ds) => [ds.uid, ds])), isLoading, error }),
    [items, isLoading, error]
  );
}

export interface RulesSourceDataSourcesResult {
  items: RulesSourceDataSource[];
  isLoading: boolean;
  error?: Error;
}

/**
 * Every data source of a supported rules source type, including the ones that do not manage alerts. Narrow
 * the result for a specific use. Refreshes when the data source cache changes.
 */
export function useRulesSourceDataSources(): RulesSourceDataSourcesResult {
  const { items, isLoading, error } = useDataSourceInstanceList(RULES_SOURCE_LIST_FILTERS);
  const rulesSources = useMemo(() => toRulesSourceDataSources(items), [items]);

  return { items: rulesSources, isLoading, error };
}
