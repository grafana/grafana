import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import coreModule from './core_module';

export function registerComponents() {
  coreModule.factory('backendSrv', () => getBackendSrv());
  coreModule.factory('contextSrv', () => contextSrv);
}
