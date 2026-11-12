/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceInstanceListItem, type ScopedVars } from '@grafana/data';
import {
  getDataSourceSrv,
  getDataSourceInstanceListItem as stableGetDataSourceInstanceListItem,
} from '@grafana/runtime';

import { toDataSourceInstanceListItem } from './getDataSourceInstanceList';
import { type Ref } from './types';

/** Prefer over `getDataSourceInstanceSettings` when identity and plugin metadata are enough. */
export async function getDataSourceInstanceListItem(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceListItem | undefined> {
  if (typeof stableGetDataSourceInstanceListItem === 'function') {
    return stableGetDataSourceInstanceListItem(ref, scopedVars);
  }

  return backwardsCompatibleGetDataSourceInstanceListItem(ref, scopedVars);
}

async function backwardsCompatibleGetDataSourceInstanceListItem(
  ref?: Ref,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceListItem | undefined> {
  const settings = getDataSourceSrv().getInstanceSettings(ref, scopedVars);
  // A template variable ref resolves to a copy named after the variable; `rawRef` points at the
  // real instance, whose uid and name the host function returns.
  const resolvedUid = settings?.rawRef?.uid;
  const resolved = resolvedUid ? (getDataSourceSrv().getInstanceSettings(resolvedUid) ?? settings) : settings;

  return resolved ? toDataSourceInstanceListItem(resolved) : undefined;
}
