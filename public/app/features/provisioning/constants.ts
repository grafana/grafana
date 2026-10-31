export const PROVISIONING_URL = '/admin/provisioning';
export const PROVISIONING_PREVIEW_URL = '/dashboard/provisioning';
/**
 * A bundle's own page. Deliberately outside PROVISIONING_URL: the admin pages are gated on
 * `provisioning.repositories:write`, and a bundle is reached from wherever the resource that
 * uses it is — not only from the admin resource tree. Access is enforced by the bundles API,
 * which the page surfaces when it refuses.
 */
export const BUNDLE_URL = '/bundles';
export const CONNECTIONS_URL = `${PROVISIONING_URL}/connections`;
export const CONNECTIONS_TAB_URL = `${PROVISIONING_URL}?tab=connections`;
export const CONNECT_URL = `${PROVISIONING_URL}/connect`;
export const GETTING_STARTED_URL = `${PROVISIONING_URL}/getting-started`;
export const UPGRADE_URL = 'https://grafana.com/profile/org/subscription';
export const CONFIGURE_GRAFANA_DOCS_URL =
  'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#provisioning';
export const GIT_SYNC_DOCS_URL = 'https://grafana.com/docs/grafana/latest/as-code/provision-resources/intro-git-sync/';
export const ANNOUNCEMENT_BANNER_DOCS_URL =
  'https://grafana.com/docs/grafana/latest/administration/announcement-banner/';

export const DEFAULT_REPOSITORY_TYPES: Array<'github' | 'local'> = ['github', 'local'];

export const DEFAULT_BRANCH_NAMES = ['main', 'master'] as const;

export const FOLDER_METADATA_FILE = '_folder.json';
