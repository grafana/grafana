import { generatedAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

export const configApi = generatedAPI;

/**
 * Config is a per-org singleton served at this fixed name (backend ConfigSingletonName). Humans
 * cannot create it — create is denied to non-service identities, and a PUT to a missing object is
 * re-authorized as create — so a 404 means "the sync worker has not seeded it yet", not "wrong name".
 */
export const CONFIG_SINGLETON_NAME = 'default';
