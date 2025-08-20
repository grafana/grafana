import { AccessControlAction } from 'app/types/accessControl';

/**
 * List of granular permissions that allow viewing contact points
 *
 * Any permission in this list will be checked for client side access to view Contact Points functionality.
 */
export const PERMISSIONS_CONTACT_POINTS_READ = [AccessControlAction.AlertingReceiversRead];

/**
 * List of granular permissions that allow modifying contact points
 */
export const PERMISSIONS_CONTACT_POINTS_MODIFY = [
  AccessControlAction.AlertingReceiversCreate,
  AccessControlAction.AlertingReceiversWrite,
];

/**
 * List of all permissions that allow contact points read/write functionality
 */
export const PERMISSIONS_CONTACT_POINTS = [...PERMISSIONS_CONTACT_POINTS_READ, ...PERMISSIONS_CONTACT_POINTS_MODIFY];
