/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceApi, type ScopedVars } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { getDataSourceInstance as rtGetDataSourceInstance } from '@grafana/runtime/unstable';

import { type Ref } from './types';

export async function getDataSourceInstance(ref?: Ref, scopedVars?: ScopedVars): Promise<DataSourceApi> {
  if (typeof rtGetDataSourceInstance === 'function') {
    return rtGetDataSourceInstance(ref, scopedVars);
  }

  return backwardsCompatibleGetDataSourceInstance(ref, scopedVars);
}

async function backwardsCompatibleGetDataSourceInstance(ref?: Ref, scopedVars?: ScopedVars): Promise<DataSourceApi> {
  return getDataSourceSrv().get(ref, scopedVars);
}
