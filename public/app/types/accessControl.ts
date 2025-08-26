/**
 * UserPermission is a map storing permissions in a form of
 * {
 *   action: true;
 * }
 */
export type UserPermission = Record<string, boolean>;

// Permission actions
export enum AccessControlAction {
  UsersRead = 'users:read',
  UsersWrite = 'users:write',
  UsersAuthTokenList = 'users.authtoken:read',
  UsersAuthTokenUpdate = 'users.authtoken:write',
  UsersPasswordUpdate = 'users.password:write',
  UsersDelete = 'users:delete',
  UsersCreate = 'users:create',
  UsersEnable = 'users:enable',
  UsersDisable = 'users:disable',
  UsersPermissionsUpdate = 'users.permissions:write',
  UsersLogout = 'users:logout',
  UsersQuotasList = 'users.quotas:read',
  UsersQuotasUpdate = 'users.quotas:write',

  ServiceAccountsRead = 'serviceaccounts:read',
  ServiceAccountsCreate = 'serviceaccounts:create',
  ServiceAccountsWrite = 'serviceaccounts:write',
  ServiceAccountsDelete = 'serviceaccounts:delete',
  ServiceAccountsPermissionsRead = 'serviceaccounts.permissions:read',
  ServiceAccountsPermissionsWrite = 'serviceaccounts.permissions:write',

  OrgsRead = 'orgs:read',
  OrgsPreferencesRead = 'orgs.preferences:read',
  OrgsWrite = 'orgs:write',
  OrgsPreferencesWrite = 'orgs.preferences:write',
  OrgsCreate = 'orgs:create',
  OrgsDelete = 'orgs:delete',
  OrgUsersRead = 'org.users:read',
  OrgUsersAdd = 'org.users:add',
  OrgUsersRemove = 'org.users:remove',
  OrgUsersWrite = 'org.users:write',

  LDAPUsersRead = 'ldap.user:read',
  LDAPUsersSync = 'ldap.user:sync',
  LDAPStatusRead = 'ldap.status:read',

  DataSourcesExplore = 'datasources:explore',
  DataSourcesRead = 'datasources:read',
  DataSourcesCreate = 'datasources:create',
  DataSourcesWrite = 'datasources:write',
  DataSourcesDelete = 'datasources:delete',
  DataSourcesPermissionsRead = 'datasources.permissions:read',
  DataSourcesCachingRead = 'datasources.caching:read',
  DataSourcesInsightsRead = 'datasources.insights:read',

  ActionServerStatsRead = 'server.stats:read',

  ActionTeamsCreate = 'teams:create',
  ActionTeamsDelete = 'teams:delete',
  ActionTeamsRead = 'teams:read',
  ActionTeamsWrite = 'teams:write',
  ActionTeamsPermissionsRead = 'teams.permissions:read',
  ActionTeamsPermissionsWrite = 'teams.permissions:write',

  ActionRolesList = 'roles:read',
  ActionTeamsRolesList = 'teams.roles:read',
  ActionTeamsRolesAdd = 'teams.roles:add',
  ActionTeamsRolesRemove = 'teams.roles:remove',
  ActionUserRolesList = 'users.roles:read',
  ActionUserRolesAdd = 'users.roles:add',
  ActionUserRolesRemove = 'users.roles:remove',

  DashboardsRead = 'dashboards:read',
  DashboardsWrite = 'dashboards:write',
  DashboardsDelete = 'dashboards:delete',
  DashboardsCreate = 'dashboards:create',
  DashboardsPermissionsRead = 'dashboards.permissions:read',
  DashboardsPermissionsWrite = 'dashboards.permissions:write',
  DashboardsPublicWrite = 'dashboards.public:write',
  SnapshotsCreate = 'snapshots:create',
  SnapshotsDelete = 'snapshots:delete',
  SnapshotsRead = 'snapshots:read',

  FoldersRead = 'folders:read',
  FoldersWrite = 'folders:write',
  FoldersDelete = 'folders:delete',
  FoldersCreate = 'folders:create',
  FoldersPermissionsRead = 'folders.permissions:read',
  FoldersPermissionsWrite = 'folders.permissions:write',

  // Support bundle actions
  ActionSupportBundlesCreate = 'support.bundles:create',
  ActionSupportBundlesRead = 'support.bundles:read',
  ActionSupportBundlesDelete = 'support.bundles:delete',

  // Alerting rules
  AlertingRuleCreate = 'alert.rules:create',
  AlertingRuleRead = 'alert.rules:read',
  AlertingRuleUpdate = 'alert.rules:write',
  AlertingRuleDelete = 'alert.rules:delete',

  // Alerting instances (+silences)
  AlertingInstanceCreate = 'alert.instances:create',
  AlertingInstanceUpdate = 'alert.instances:write',
  AlertingInstanceRead = 'alert.instances:read',

  // Alerting silences
  AlertingSilenceCreate = 'alert.silences:create',
  AlertingSilenceUpdate = 'alert.silences:write',
  AlertingSilenceRead = 'alert.silences:read',

  // Alerting Notification policies
  AlertingNotificationsRead = 'alert.notifications:read',
  AlertingNotificationsWrite = 'alert.notifications:write',

  // External alerting rule actions.
  AlertingRuleExternalWrite = 'alert.rules.external:write',
  AlertingRuleExternalRead = 'alert.rules.external:read',

  // External alerting instances actions.
  AlertingInstancesExternalWrite = 'alert.instances.external:write',
  AlertingInstancesExternalRead = 'alert.instances.external:read',

  // External alerting notifications actions.
  AlertingNotificationsExternalWrite = 'alert.notifications.external:write',
  AlertingNotificationsExternalRead = 'alert.notifications.external:read',

  // Alerting provisioning actions
  AlertingProvisioningReadSecrets = 'alert.provisioning.secrets:read',
  AlertingProvisioningRead = 'alert.provisioning:read',
  AlertingProvisioningWrite = 'alert.provisioning:write',
  AlertingRulesProvisioningRead = 'alert.rules.provisioning:read',
  AlertingRulesProvisioningWrite = 'alert.rules.provisioning:write',
  AlertingNotificationsProvisioningRead = 'alert.notifications.provisioning:read',
  AlertingNotificationsProvisioningWrite = 'alert.notifications.provisioning:write',
  AlertingProvisioningSetStatus = 'alert.provisioning.provenance:write',

  // Alerting receivers actions
  AlertingReceiversPermissionsRead = 'receivers.permissions:read',
  AlertingReceiversPermissionsWrite = 'receivers.permissions:write',
  AlertingReceiversCreate = 'alert.notifications.receivers:create',
  AlertingReceiversWrite = 'alert.notifications.receivers:write',
  AlertingReceiversRead = 'alert.notifications.receivers:read',

  // Alerting routes actions
  AlertingRoutesRead = 'alert.notifications.routes:read',
  AlertingRoutesWrite = 'alert.notifications.routes:write',

  // Alerting time intervals actions
  AlertingTimeIntervalsRead = 'alert.notifications.time-intervals:read',
  AlertingTimeIntervalsWrite = 'alert.notifications.time-intervals:write',

  // Alerting templates actions
  AlertingTemplatesRead = 'alert.notifications.templates:read',
  AlertingTemplatesWrite = 'alert.notifications.templates:write',
  AlertingTemplatesDelete = 'alert.notifications.templates:delete',

  ActionAPIKeysRead = 'apikeys:read',
  ActionAPIKeysCreate = 'apikeys:create',
  ActionAPIKeysDelete = 'apikeys:delete',

  PluginsInstall = 'plugins:install',
  PluginsWrite = 'plugins:write',

  // Settings
  SettingsRead = 'settings:read',
  SettingsWrite = 'settings:write',

  // GroupSync
  GroupSyncMappingsRead = 'groupsync.mappings:read',
  GroupSyncMappingsWrite = 'groupsync.mappings:write',

  // Migration Assistant
  MigrationAssistantMigrate = 'migrationassistant:migrate',
}

export interface Role {
  uid: string;
  name: string;
  displayName: string;
  filteredDisplayName: string; // name to be shown in filtered role list
  description: string;
  group: string;
  global: boolean;
  delegatable?: boolean;
  mapped?: boolean;
  version: number;
  created: string;
  updated: string;
}
