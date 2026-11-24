import { type DataQueryRequest } from '@grafana/data';
import { DataSourceType } from '@grafana/flamegraph';
import { useDataSourceInstanceSettings } from '@grafana/runtime';

const PYROSCOPE_PLUGIN_ID = 'grafana-pyroscope-datasource';

export function dataSourceTypeFromPluginId(pluginId?: string): DataSourceType {
  return pluginId === PYROSCOPE_PLUGIN_ID ? DataSourceType.PprofPyroscope : DataSourceType.Unknown;
}

export function useFlameGraphDataSourceType(request?: DataQueryRequest): DataSourceType {
  const ref = request?.targets?.find((t) => t.datasource)?.datasource;
  const { settings } = useDataSourceInstanceSettings(ref?.uid);

  const type = ref?.type ?? (ref?.uid ? settings?.type : undefined);
  return dataSourceTypeFromPluginId(type);
}
