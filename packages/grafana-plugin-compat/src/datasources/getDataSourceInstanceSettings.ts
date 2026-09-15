/* eslint-disable @grafana/no-get-data-source-srv */
import { type ScopedVars, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { getDataSourceInstanceSettings as rtGetDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataSourceRef } from '@grafana/schema';

type Ref = DataSourceRef | string | null;

export function getDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  if (typeof rtGetDataSourceInstanceSettings === 'function') {
    return rtGetDataSourceInstanceSettings(ref, scopedVars);
  }

  return backwardsCompatibleDataSourceInstanceSettings(ref, scopedVars);
}

function backwardsCompatibleDataSourceInstanceSettings(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  return Promise.resolve(getDataSourceSrv().getInstanceSettings(ref, scopedVars));
}
