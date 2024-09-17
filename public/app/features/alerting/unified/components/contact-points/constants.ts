import { AccessControlAction } from 'app/types';

export const RECEIVER_STATUS_KEY = Symbol('receiver_status');
export const RECEIVER_META_KEY = Symbol('receiver_metadata');
export const RECEIVER_PLUGIN_META_KEY = Symbol('receiver_plugin_metadata');

/**
 * List of any permissions that necessitate showing contact points functionality
 *
 * Any permission in this list will be checked for client side access to Contact Points functionality.
 *
 * Any permission in this list will also be checked for whether the built-in Grafana Alertmanager is shown
 * (as the implication is that if they have one of these permissions, then they should be able to see Grafana AM in the AM selector)
 */

export const PERMISSIONS_CONTACT_POINTS = [
  AccessControlAction.AlertingReceiversCreate,
  AccessControlAction.AlertingReceiversRead,
  AccessControlAction.AlertingReceiversWrite,
];
