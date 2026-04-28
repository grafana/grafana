export const PROVISIONING_URL = '/admin/provisioning';
export const PROVISIONING_PREVIEW_URL = '/dashboard/provisioning';
export const CONNECTIONS_URL = `${PROVISIONING_URL}/connections`;
export const CONNECTIONS_TAB_URL = `${PROVISIONING_URL}?tab=connections`;
export const STATS_TAB_URL = `${PROVISIONING_URL}?tab=stats`;
export const CONNECT_URL = `${PROVISIONING_URL}/connect`;
export const GETTING_STARTED_URL = `${PROVISIONING_URL}/getting-started`;
export const UPGRADE_URL = 'https://grafana.com/profile/org/subscription';
export const CONFIGURE_GRAFANA_DOCS_URL =
  'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#provisioning';

export const DEFAULT_REPOSITORY_TYPES: Array<'github' | 'local'> = ['github', 'local'];

export const DEFAULT_BRANCH_NAMES = ['main', 'master'] as const;

export const FOLDER_METADATA_FILE = '_folder.json';
