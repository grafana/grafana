import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

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
