import { AccessControlAction } from 'app/types/accessControl';

/**
 * List of granular permissions that allow viewing notification policies
 */
export const PERMISSIONS_NOTIFICATION_POLICIES_READ = [AccessControlAction.AlertingRoutesRead];

/**
 * List of granular permissions that allow modifying notification policies
 */
export const PERMISSIONS_NOTIFICATION_POLICIES_MODIFY = [AccessControlAction.AlertingRoutesWrite];

export const PERMISSIONS_NOTIFICATION_POLICIES = [
  ...PERMISSIONS_NOTIFICATION_POLICIES_READ,
  ...PERMISSIONS_NOTIFICATION_POLICIES_MODIFY,
];
