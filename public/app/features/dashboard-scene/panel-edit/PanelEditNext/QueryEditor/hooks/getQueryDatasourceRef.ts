import { type DataQuery, type DataSourceRef, type ScopedVars, getDataSourceRef } from '@grafana/data';
import { config, getDataSourceInstanceSettings } from '@grafana/runtime';

export function getQueryDatasourceRef(query: DataQuery, inherited: DataSourceRef | undefined) {
  // Mixed delegates to each query; legacy queries without a ref use the default editor datasource.
  return (
    query.datasource ??
    (inherited?.uid === '-- Mixed --' || inherited?.type === 'mixed' ? config.defaultDatasource : inherited)
  );
}

// Instance resolution also honors Mixed metadata and canonicalizes the configured default ref.
export async function resolveQueryDatasourceRef(
  query: DataQuery,
  inherited: DataSourceRef | undefined,
  scopedVars: ScopedVars
) {
  const raw = query.datasource ?? inherited;
  const settings = await getDataSourceInstanceSettings(raw, scopedVars);
  if (!query.datasource && (settings?.meta.mixed || inherited?.uid === '-- Mixed --' || inherited?.type === 'mixed')) {
    const defaults = await getDataSourceInstanceSettings(config.defaultDatasource, scopedVars);
    return defaults ? { ref: getDataSourceRef(defaults), settings: defaults } : undefined;
  }
  return { ref: raw, settings };
}
