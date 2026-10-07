import { getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

export function normalizeDataSourceRef(ds: DataSourceRef | string | null | undefined): DataSourceRef | undefined {
  if (!ds) {
    return undefined;
  }

  if (typeof ds === 'string') {
    if (ds.startsWith('$')) {
      return { uid: ds };
    }

    const instance = getDataSourceSrv().getInstanceSettings(ds);
    return instance ? getDataSourceRef(instance) : { uid: ds };
  }

  return Object.keys(ds).length === 0 ? undefined : ds;
}
