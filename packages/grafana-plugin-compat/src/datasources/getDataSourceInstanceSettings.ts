/* eslint-disable @grafana/no-get-data-source-srv */
import { type ScopedVars, type DataSourceInstanceSettings } from '@grafana/data';
import {
  getDataSourceSrv,
  getDataSourceInstanceSettings as stableGetDataSourceInstanceSettings,
} from '@grafana/runtime';

import { type Ref } from './types';

export async function getDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  if (typeof stableGetDataSourceInstanceSettings === 'function') {
    return stableGetDataSourceInstanceSettings(ref, scopedVars);
  }

  return backwardsCompatibleDataSourceInstanceSettings(ref, scopedVars);
}

async function backwardsCompatibleDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  return getDataSourceSrv().getInstanceSettings(ref, scopedVars);
}
