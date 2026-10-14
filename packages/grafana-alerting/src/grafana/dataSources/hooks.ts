import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

import { RECORDING_TARGET_FILTERS } from './narrowings';

export interface DataSourcesWithValidRecordingTargetResult {
  items: DataSourceInstanceListItem[];
  isLoading: boolean;
  error?: Error;
}

export function useDataSourcesWithValidRecordingTarget(): DataSourcesWithValidRecordingTargetResult {
  const { items, isLoading, error } = useDataSourceInstanceList(RECORDING_TARGET_FILTERS);

  return { items, isLoading, error };
}
