/* eslint-disable @grafana/no-get-data-source-srv */
import {
  getDataSourceSrv,
  type RuntimeDataSourceRegistration,
  registerRuntimeDataSourceInstance as stableRegisterRuntimeDataSourceInstance,
} from '@grafana/runtime';
import { registerRuntimeDataSourceInstance as unstableRegisterRuntimeDataSourceInstance } from '@grafana/runtime/unstable';

export function registerRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  if (typeof stableRegisterRuntimeDataSourceInstance === 'function') {
    return stableRegisterRuntimeDataSourceInstance(entry);
  }

  if (typeof unstableRegisterRuntimeDataSourceInstance === 'function') {
    return unstableRegisterRuntimeDataSourceInstance(entry);
  }

  return backwardsCompatibleRegisterRuntimeDataSourceInstance(entry);
}

function backwardsCompatibleRegisterRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  return getDataSourceSrv().registerRuntimeDataSource(entry);
}
