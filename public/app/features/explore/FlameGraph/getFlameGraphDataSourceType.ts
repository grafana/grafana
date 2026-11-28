import { type DataQueryRequest, type DataFrame } from '@grafana/data';
import { DataSourceType } from '@grafana/flamegraph';
import { useDataSourceInstanceSettings } from '@grafana/runtime';

const PYROSCOPE_PLUGIN_ID = 'grafana-pyroscope-datasource';

export function dataSourceTypeFromPluginId(pluginId?: string): DataSourceType {
  return pluginId === PYROSCOPE_PLUGIN_ID ? DataSourceType.PprofPyroscope : DataSourceType.Unknown;
}

export function useFlameGraphDataSourceType(request?: DataQueryRequest, frame?: DataFrame): DataSourceType {
  const targets = (request?.targets ?? []).filter((t) => t.datasource);
  // in a mixed request, find the query that produced this frame by refId
  const matched = frame?.refId ? targets.find((t) => t.refId === frame.refId) : undefined;
  // when there is no refId match, check that all queries use the same data source
  const hasSingleDataSource = new Set(targets.map((t) => t.datasource?.uid)).size === 1;
  const ref = (matched ?? (hasSingleDataSource ? targets[0] : undefined))?.datasource;

  const { settings } = useDataSourceInstanceSettings(ref?.uid);

  const type = ref?.type ?? (ref?.uid ? settings?.type : undefined);
  return dataSourceTypeFromPluginId(type);
}
