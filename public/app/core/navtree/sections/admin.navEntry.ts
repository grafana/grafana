import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { buildEntries, has, hasAny, isOrgAdmin, type NavEntryBuilder } from '../utils';

// Page-access predicates shared with the route guards in
// public/app/routes/routes.tsx, so nav visibility and route access can't drift.
const serviceAccountsAccess = () =>
  hasAny(AccessControlAction.ServiceAccountsRead, AccessControlAction.ServiceAccountsCreate);
const migrateToCloudAccess = () => has(AccessControlAction.MigrationAssistantMigrate);

const ADMIN_GENERAL_CHILDREN: NavEntryBuilder[] = [
  {
    // Replaces the OSS licensing index-data hook (pkg/services/licensing/oss.go)
    // for the client-built tree. The edition gate mirrors the wire-level
    // substitution: enterprise binaries replace the OSS licensing service, so
    // the hook never runs there and enterprise registers its own licensing
    // item via the nav entry registry instead.
    when: () => contextSrv.isGrafanaAdmin && config.buildInfo.edition === GrafanaEdition.OpenSource,
    build: () => ({
      text: 'Stats and license',
      id: 'upgrading',
      url: '/admin/upgrading',
      icon: 'unlock',
      sortWeight: -1,
    }),
  },
  {
    when: () =>
      (has(AccessControlAction.OrgsRead) && has(AccessControlAction.OrgsWrite)) ||
      (has(AccessControlAction.OrgsPreferencesRead) && has(AccessControlAction.OrgsPreferencesWrite)),
    build: () => ({
      text: 'Default preferences',
      id: 'org-settings',
      subTitle: 'Manage preferences across an organization',
      icon: 'sliders-v-alt',
      url: '/org',
    }),
  },
  {
    when: () => has(AccessControlAction.SettingsRead),
    build: () => ({
      text: 'Settings',
      subTitle: 'View the settings defined in your Grafana config',
      id: 'server-settings',
      url: '/admin/settings',
      icon: 'sliders-v-alt',
    }),
  },
  {
    // Backend evaluates orgs:read in the global scope; the frontend permissions
    // map is org-scoped, so require server admin as well to approximate it.
    when: () => contextSrv.isGrafanaAdmin && has(AccessControlAction.OrgsRead),
    build: () => ({
      text: 'Organizations',
      subTitle: 'Isolated instances of Grafana running on the same server',
      id: 'global-orgs',
      url: '/admin/orgs',
      icon: 'building',
    }),
  },
  {
    when: () => Boolean(config.cloudMigrationEnabled) && migrateToCloudAccess(),
    build: () => ({
      text: 'Migrate to Grafana Cloud',
      id: 'migrate-to-cloud',
      subTitle: 'Copy resources from your self-managed installation to a cloud stack',
      url: '/admin/migrate-to-cloud',
    }),
  },
  {
    // Mirrors navtreeimpl/admin.go: the backend-populated provisioningEnabled
    // config param, gated via the inclusive HasRole(RoleAdmin) — org admin or
    // Grafana server admin.
    when: () => (isOrgAdmin() || contextSrv.isGrafanaAdmin) && config.provisioningEnabled,
    build: () => ({
      text: 'Provisioning',
      id: 'provisioning',
      subTitle: 'View and manage your provisioning connections',
      url: '/admin/provisioning',
      keywords: ['git sync', 'git-sync', 'repository', 'version control', 'as code'],
    }),
  },
];

const ADMIN_PLUGINS_CHILDREN: NavEntryBuilder[] = [
  {
    when: () =>
      isOrgAdmin() ||
      (config.pluginAdminEnabled && contextSrv.isGrafanaAdmin) ||
      hasAny(AccessControlAction.PluginsWrite, AccessControlAction.PluginsInstall),
    build: () => ({
      text: 'Plugins',
      id: 'plugins',
      subTitle: 'Extend the Grafana experience with plugins',
      icon: 'plug',
      url: '/plugins',
    }),
  },
  {
    when: () => has(AccessControlAction.DataSourcesExplore),
    build: () => ({
      text: 'Correlations',
      icon: 'gf-glue',
      subTitle: 'Add and configure correlations',
      id: 'correlations',
      url: '/datasources/correlations',
    }),
  },
  {
    when: () =>
      config.buildInfo.env === 'development' ||
      (Boolean(config.featureToggles.enableExtensionsAdminPage) &&
        hasAny(AccessControlAction.PluginsWrite, AccessControlAction.PluginsInstall)),
    build: () => ({
      text: 'Extensions',
      icon: 'plug',
      subTitle: 'Extend the UI of plugins and Grafana',
      id: 'extensions',
      url: '/admin/extensions',
    }),
  },
];

const ADMIN_ACCESS_CHILDREN: NavEntryBuilder[] = [
  {
    when: () => hasAny(AccessControlAction.OrgUsersRead, AccessControlAction.UsersRead),
    build: () => ({
      text: 'Users',
      subTitle: 'Manage users in Grafana',
      id: 'global-users',
      url: '/admin/users',
      icon: 'user',
    }),
  },
  {
    when: () =>
      has(AccessControlAction.ActionTeamsCreate) ||
      (has(AccessControlAction.ActionTeamsRead) &&
        hasAny(
          AccessControlAction.ActionTeamsWrite,
          AccessControlAction.ActionTeamsPermissionsWrite,
          AccessControlAction.ActionTeamsPermissionsRead
        )),
    build: () => ({
      text: 'Teams',
      id: 'teams',
      subTitle: 'Groups of users that have common dashboard and permission needs',
      icon: 'users-alt',
      url: '/org/teams',
    }),
  },
  {
    when: serviceAccountsAccess,
    build: () => ({
      text: 'Service accounts',
      id: 'serviceaccounts',
      subTitle: 'Use service accounts to run automated workloads in Grafana',
      icon: 'gf-service-account',
      url: '/org/serviceaccounts',
    }),
  },
];

// The backend evaluates these with settings scopes (SAML/OAuth providers)
// which the frontend permissions map cannot express; the unscoped actions are
// the closest approximation.
const authSettingsAccess = () => {
  const samlLicensed = Boolean(config.licenseInfo?.enabledFeatures?.saml);
  const authConfigUIAvailable = samlLicensed || config.ldapEnabled;
  const canEditAuthSettings = has(AccessControlAction.SettingsRead) && has(AccessControlAction.SettingsWrite);
  const canReadLDAPStatus = has(AccessControlAction.LDAPStatusRead);
  const canManageSSOSettings = hasAny(AccessControlAction.SettingsRead, AccessControlAction.SettingsWrite);

  return (authConfigUIAvailable && (canEditAuthSettings || canReadLDAPStatus)) || canManageSSOSettings;
};

const ADMIN_CONFIG_NODES: NavEntryBuilder[] = [
  {
    // Always present (even when empty) so enterprise items (e.g. banner
    // settings) can be registered into it; pruned late when nothing attached
    when: () => true,
    build: () => ({
      text: 'General',
      subTitle: 'Manage default preferences and settings across Grafana',
      id: NavID.cfgGeneral,
      url: '/admin/general',
      icon: 'shield',
      children: buildEntries(ADMIN_GENERAL_CHILDREN),
    }),
  },
  {
    // Always present (even when empty) so enterprise items (e.g. recorded
    // queries) can be registered into it; pruned late when nothing attached
    when: () => true,
    build: () => ({
      text: 'Plugins and data',
      subTitle: 'Install plugins and define the relationships between data',
      id: NavID.cfgPlugins,
      url: '/admin/plugins',
      icon: 'shield',
      children: buildEntries(ADMIN_PLUGINS_CHILDREN),
    }),
  },
  {
    // Always present (even when empty) so grafana-auth-app can inject into it
    when: () => true,
    build: () => ({
      text: 'Users and access',
      subTitle: 'Configure access for individual users, teams, and service accounts',
      id: NavID.cfgAccess,
      url: '/admin/access',
      icon: 'shield',
      children: buildEntries(ADMIN_ACCESS_CHILDREN),
    }),
  },
  {
    when: authSettingsAccess,
    build: () => ({
      text: 'Authentication',
      id: 'authentication',
      subTitle: 'Manage your auth settings and configure single sign-on',
      icon: 'signin',
      isSection: true,
      url: '/admin/authentication',
    }),
  },
];

export const adminNavEntry: NavEntryBuilder = {
  when: () => true,
  build: (): NavModelItem => ({
    id: NavID.cfg,
    text: 'Administration',
    subTitle: `Organization: ${contextSrv.user.orgName}`,
    icon: 'cog',
    sortWeight: NavWeight.config,
    children: buildEntries(ADMIN_CONFIG_NODES),
    url: '/admin',
  }),
};
