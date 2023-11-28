import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
export function getAddToDashboardTitle() {
    const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
    const canWriteDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
    if (canCreateDashboard && !canWriteDashboard) {
        return 'Add panel to new dashboard';
    }
    if (canWriteDashboard && !canCreateDashboard) {
        return 'Add panel to existing dashboard';
    }
    return 'Add panel to dashboard';
}
//# sourceMappingURL=getAddToDashboardTitle.js.map