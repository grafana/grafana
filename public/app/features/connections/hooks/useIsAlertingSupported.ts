import { useDatasourcePluginMeta } from '@grafana/runtime/internal';

export function useIsAlertingSupported(datasourceType: string): boolean {
  const { value: meta } = useDatasourcePluginMeta(datasourceType);
  return Boolean(meta?.alerting) || meta?.id === 'alertmanager';
}
