import { useDatasourcePluginMeta } from '@grafana/runtime/internal';

export interface IsAlertingSupported {
  isSupported: boolean;
  isLoading: boolean;
}

/**
 * Returns whether the datasource supports alerting. While isLoading is true
 * the answer is not known yet (plugin meta still loading or datasource type
 * not resolved) and isSupported should not be trusted — consumers should wait
 * for isLoading to be false to avoid flashing incorrect UI.
 */
export function useIsAlertingSupported(datasourceType: string): IsAlertingSupported {
  const { loading, value: meta } = useDatasourcePluginMeta(datasourceType);
  const isLoading = !datasourceType || loading;

  return {
    isLoading,
    isSupported: !isLoading && (Boolean(meta?.alerting) || meta?.id === 'alertmanager'),
  };
}
