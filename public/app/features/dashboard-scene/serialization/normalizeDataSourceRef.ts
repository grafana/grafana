import { type DataSourceRef } from '@grafana/schema';

export function normalizeDataSourceRef(ds: DataSourceRef | string | null | undefined): DataSourceRef | undefined {
  if (!ds) {
    return undefined;
  }

  // Known datasource names are resolved to refs when a v1 dashboard is loaded (see resolveLegacyDatasourceNames),
  // so a string that is left is a template variable or an unknown datasource.
  if (typeof ds === 'string') {
    return { uid: ds };
  }

  return Object.keys(ds).length === 0 ? undefined : ds;
}
