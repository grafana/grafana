import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

export function getAddToDashboardTitle(): string {
  const canCreateDashboard = contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor);
  const canWriteDashboard = contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor);

  if (canCreateDashboard && !canWriteDashboard) {
    return 'Add panel to new dashboard';
  }

  if (canWriteDashboard && !canCreateDashboard) {
    return 'Add panel to existing dashboard';
  }

  return 'Add panel to dashboard';
}
