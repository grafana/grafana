/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceApi, type ScopedVars } from '@grafana/data';
import { getDataSourceSrv, getDataSourceInstance as stableGetDataSourceInstance } from '@grafana/runtime';

import { type Ref } from './types';

export async function getDataSourceInstance(ref?: Ref, scopedVars?: ScopedVars): Promise<DataSourceApi> {
  if (typeof stableGetDataSourceInstance === 'function') {
    return stableGetDataSourceInstance(ref, scopedVars);
  }

  return backwardsCompatibleGetDataSourceInstance(ref, scopedVars);
}

async function backwardsCompatibleGetDataSourceInstance(ref?: Ref, scopedVars?: ScopedVars): Promise<DataSourceApi> {
  return getDataSourceSrv().get(ref, scopedVars);
}
