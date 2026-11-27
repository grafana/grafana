import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

interface CanImportToGMA {
  /** Importing rules requires rule creation + provisioning status (available to Editors). */
  canImportRules: boolean;
  /** Importing notification config requires notification write (Admin only). */
  canImportNotifications: boolean;
}

/** Both permissions are required: the convert endpoints check them together (see ngalert authorization.go). */
export function canImportRulesToGMA(): boolean {
  return (
    contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate) &&
    contextSrv.hasPermission(AccessControlAction.AlertingProvisioningSetStatus)
  );
}

/**
 * Permissions required to use the Import to GMA wizard, aligned with the backend
 * authorization for the convert endpoints (see ngalert authorization.go).
 */
export function useCanImportToGMA(): CanImportToGMA {
  return {
    canImportRules: canImportRulesToGMA(),
    canImportNotifications: contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite),
  };
}
