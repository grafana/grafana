import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { migrateToCloudAccess, serviceAccountsAccess } from '../pageAccess';
import { buildEntries, hasAny, type NavEntryBuilder } from '../utils';

const canManageOrgs = () =>
  contextSrv.hasPermission(AccessControlAction.OrgsRead) && contextSrv.hasPermission(AccessControlAction.OrgsWrite);
const canManageOrgPreferences = () =>
  contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead) &&
  contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);
// Server admin is required on top of the org-scoped orgs:read the frontend
// sees, because the item is global: a custom role granting only global
// orgs:read passes on the server but not here (hidden, never leaked). The
// scoped-permissions fetch will let us drop the server-admin approximation.
const canViewGlobalOrgs = () => contextSrv.isGrafanaAdmin && contextSrv.hasPermission(AccessControlAction.OrgsRead);

const ADMIN_GENERAL_CHILDREN: NavEntryBuilder[] = [
  {
    // The edition gate mirrors the wire-level substitution: enterprise binaries
    // replace the OSS licensing service, so this OSS-only item is hidden there
    // and enterprise registers its own licensing item via the registry.
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
    when: () => canManageOrgs() || canManageOrgPreferences(),
    build: () => ({
      text: 'Default preferences',
      id: 'org-settings',
      subTitle: 'Manage preferences across an organization',
      icon: 'sliders-v-alt',
      url: '/org',
    }),
  },
  {
    // The bootdata permissions map collapses every settings:read scope into one
    // boolean, so an OAuth/SAML-scoped grant passes here even though the page
    // requires settings:*. Accepted for now: the scoped-permissions fetch (the
    // same one the plugin-access work introduces) will let this require the
    // full scope, matching the server nav and API.
    when: () => contextSrv.hasPermission(AccessControlAction.SettingsRead),
    build: () => ({
      text: 'Settings',
      subTitle: 'View the settings defined in your Grafana config',
      id: 'server-settings',
      url: '/admin/settings',
      icon: 'sliders-v-alt',
    }),
  },
  {
    when: canViewGlobalOrgs,
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
    when: () => (contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin) && config.provisioningEnabled,
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
      contextSrv.hasRole('Admin') ||
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
    when: () => contextSrv.hasPermission(AccessControlAction.DataSourcesExplore),
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

const canCreateTeams = () => contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate);
const canManageTeams = () =>
  contextSrv.hasPermission(AccessControlAction.ActionTeamsRead) &&
  hasAny(
    AccessControlAction.ActionTeamsWrite,
    AccessControlAction.ActionTeamsPermissionsWrite,
    AccessControlAction.ActionTeamsPermissionsRead
  );

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
    when: () => canCreateTeams() || canManageTeams(),
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
  const canEditAuthSettings =
    contextSrv.hasPermission(AccessControlAction.SettingsRead) &&
    contextSrv.hasPermission(AccessControlAction.SettingsWrite);
  const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
  const canManageSSOSettings = hasAny(AccessControlAction.SettingsRead, AccessControlAction.SettingsWrite);

  return (authConfigUIAvailable && (canEditAuthSettings || canReadLDAPStatus)) || canManageSSOSettings;
};

const ADMIN_CONFIG_NODES: NavEntryBuilder[] = [
  {
    // Always present (even when empty) so enterprise items (e.g. banner
    // settings) can be registered into it; pruned late when nothing attached
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
