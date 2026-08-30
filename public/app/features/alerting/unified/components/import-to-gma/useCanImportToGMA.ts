import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

interface CanImportToGMA {
  /** Importing rules requires rule creation + provisioning status (available to Editors). */
  canImportRules: boolean;
  /** Importing notification config requires notification write (Admin only). */
  canImportNotifications: boolean;
}

/**
 * Permissions required to use the Import to GMA wizard, aligned with the backend
 * authorization for the convert endpoints (see ngalert authorization.go).
 */
export function useCanImportToGMA(): CanImportToGMA {
  const canImportNotifications = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite);
  const canImportRules =
    contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate) &&
    contextSrv.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

  return {
    canImportRules,
    canImportNotifications,
  };
}
