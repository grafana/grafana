/* eslint-disable @grafana/no-get-data-source-srv */
import { type ScopedVars, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { getDataSourceInstanceSettings as rtGetDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { type Ref } from './types';

export async function getDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  if (typeof rtGetDataSourceInstanceSettings === 'function') {
    return rtGetDataSourceInstanceSettings(ref, scopedVars);
  }

  return backwardsCompatibleDataSourceInstanceSettings(ref, scopedVars);
}

async function backwardsCompatibleDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  return getDataSourceSrv().getInstanceSettings(ref, scopedVars);
}
