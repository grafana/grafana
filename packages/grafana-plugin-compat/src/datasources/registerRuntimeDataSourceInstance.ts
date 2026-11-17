/* eslint-disable @grafana/no-get-data-source-srv */
import {
  getDataSourceSrv,
  type RuntimeDataSourceRegistration,
  registerRuntimeDataSourceInstance as stableRegisterRuntimeDataSourceInstance,
} from '@grafana/runtime';

export function registerRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  if (typeof stableRegisterRuntimeDataSourceInstance === 'function') {
    return stableRegisterRuntimeDataSourceInstance(entry);
  }

  return backwardsCompatibleRegisterRuntimeDataSourceInstance(entry);
}

function backwardsCompatibleRegisterRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  return getDataSourceSrv().registerRuntimeDataSource(entry);
}
