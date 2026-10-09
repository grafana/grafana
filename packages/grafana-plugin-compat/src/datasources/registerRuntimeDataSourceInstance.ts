/* eslint-disable @grafana/no-get-data-source-srv */
import { getDataSourceSrv, type RuntimeDataSourceRegistration } from '@grafana/runtime';
import { registerRuntimeDataSourceInstance as rtRegisterRuntimeDataSourceInstance } from '@grafana/runtime/unstable';

export function registerRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  if (typeof rtRegisterRuntimeDataSourceInstance === 'function') {
    return rtRegisterRuntimeDataSourceInstance(entry);
  }

  return backwardsCompatibleRegisterRuntimeDataSourceInstance(entry);
}

function backwardsCompatibleRegisterRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  return getDataSourceSrv().registerRuntimeDataSource(entry);
}
