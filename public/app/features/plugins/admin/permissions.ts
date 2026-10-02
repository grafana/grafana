import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

function isGrafanaAdmin(): boolean {
  return contextSrv.user.isGrafanaAdmin;
}

function isOrgAdmin() {
  return contextSrv.hasRole('Admin');
}

export function isDataSourceEditor() {
  return (
    contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
    contextSrv.hasPermission(AccessControlAction.DataSourcesWrite)
  );
}
