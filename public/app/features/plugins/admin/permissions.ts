import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
// @todo: replace barrel import path
import { AccessControlAction } from 'app/types/index';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}

export function isOrgAdmin() {
  return contextSrv.hasRole('Admin');
}

export function isDataSourceEditor() {
  return (
    contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
    contextSrv.hasPermission(AccessControlAction.DataSourcesWrite)
  );
}
