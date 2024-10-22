import { AccessControlAction } from 'app/types';

/**
 * List of granular permissions that allow viewing contact points
 *
 * Any permission in this list will be checked for client side access to view Contact Points functionality.
 */
const PERMISSIONS_CONTACT_POINTS_READ = [AccessControlAction.AlertingReceiversRead];

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

/**
 * List of all permissions that allow templates read/write functionality
 */
export const PERMISSIONS_TEMPLATES = [
  AccessControlAction.AlertingTemplatesRead,
  AccessControlAction.AlertingTemplatesWrite,
  AccessControlAction.AlertingTemplatesDelete,
];

/**
 * Any permission in this list will be used to check whether the built-in Grafana Alertmanager is shown
 * (as the implication is that if they have one of these permissions, then they should be able to see Grafana AM in the AM selector)
 */
export const PERMISSIONS_GRAFANA_ALERTMANAGER = [...PERMISSIONS_CONTACT_POINTS, ...PERMISSIONS_TEMPLATES];
