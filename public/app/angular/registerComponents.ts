import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';
import coreModule from './core_module';
import { AnnotationsSrv } from './services/annotations_srv';

export function registerComponents() {
  coreModule.factory('backendSrv', () => getBackendSrv());
  coreModule.factory('contextSrv', () => contextSrv);
  coreModule.factory('dashboardSrv', () => getDashboardSrv());
  coreModule.factory('datasourceSrv', () => getDataSourceSrv());
  coreModule.factory('linkSrv', () => getLinkSrv());
  coreModule.service('annotationsSrv', AnnotationsSrv);
}
