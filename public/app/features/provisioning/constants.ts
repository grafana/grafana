export const PROVISIONING_URL = '/admin/provisioning';
export const CONNECTIONS_URL = `${PROVISIONING_URL}/connections`;
export const CONNECTIONS_TAB_URL = `${PROVISIONING_URL}?tab=connections`;
export const CONNECT_URL = `${PROVISIONING_URL}/connect`;
export const GETTING_STARTED_URL = `${PROVISIONING_URL}/getting-started`;
export const UPGRADE_URL = 'https://grafana.com/profile/org/subscription';

export const DEFAULT_REPOSITORY_TYPES: Array<'github' | 'local'> = ['github', 'local'];

// TODO: use the limits from the API when they are available
export const FREE_TIER_CONNECTION_LIMIT = 1;

export const DEFAULT_BRANCH_NAMES = ['main', 'master'] as const;
