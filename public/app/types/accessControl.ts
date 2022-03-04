/**
 * UserPermission is a map storing permissions in a form of
 * {
 *   action: { scope: scope }
 * }
 */
export type UserPermission = {
  [key: string]: { [key: string]: string };
};

// Permission actions
export enum AccessControlAction {
  UsersRead = 'users:read',
  UsersWrite = 'users:write',
  UsersTeamRead = 'users.teams:read',
  UsersAuthTokenList = 'users.authtoken:list',
  UsersAuthTokenUpdate = 'users.authtoken:update',
  UsersPasswordUpdate = 'users.password:update',
  UsersDelete = 'users:delete',
  UsersCreate = 'users:create',
  UsersEnable = 'users:enable',
  UsersDisable = 'users:disable',
  UsersPermissionsUpdate = 'users.permissions:update',
  UsersLogout = 'users:logout',
  UsersQuotasList = 'users.quotas:list',
  UsersQuotasUpdate = 'users.quotas:update',

  ServiceAccountsCreate = 'serviceaccounts:create',
  ServiceAccountsWrite = 'serviceaccounts:write',
  ServiceAccountsDelete = 'serviceaccounts:delete',

  OrgsRead = 'orgs:read',
  OrgsPreferencesRead = 'orgs.preferences:read',
  OrgsWrite = 'orgs:write',
  OrgsPreferencesWrite = 'orgs.preferences:write',
  OrgsCreate = 'orgs:create',
  OrgsDelete = 'orgs:delete',
  OrgUsersRead = 'org.users:read',
  OrgUsersAdd = 'org.users:add',
  OrgUsersRemove = 'org.users:remove',
  OrgUsersRoleUpdate = 'org.users.role:update',

  LDAPUsersRead = 'ldap.user:read',
  LDAPUsersSync = 'ldap.user:sync',
  LDAPStatusRead = 'ldap.status:read',

  DataSourcesExplore = 'datasources:explore',
  DataSourcesRead = 'datasources:read',
  DataSourcesCreate = 'datasources:create',
  DataSourcesWrite = 'datasources:write',
  DataSourcesDelete = 'datasources:delete',
  DataSourcesPermissionsRead = 'datasources.permissions:read',

  ActionServerStatsRead = 'server.stats:read',

  ActionTeamsCreate = 'teams:create',
  ActionTeamsDelete = 'teams:delete',
  ActionTeamsRead = 'teams:read',
  ActionTeamsWrite = 'teams:write',
  ActionTeamsPermissionsRead = 'teams.permissions:read',
  ActionTeamsPermissionsWrite = 'teams.permissions:write',

  ActionRolesList = 'roles:list',
  ActionBuiltinRolesList = 'roles.builtin:list',
  ActionTeamsRolesList = 'teams.roles:list',
  ActionTeamsRolesAdd = 'teams.roles:add',
  ActionTeamsRolesRemove = 'teams.roles:remove',
  ActionUserRolesList = 'users.roles:list',

  DashboardsRead = 'dashboards:read',
  DashboardsWrite = 'dashboards:write',
  DashboardsDelete = 'dashboards:delete',
  DashboardsCreate = 'dashboards:create',
  DashboardsPermissionsRead = 'dashboards.permissions:read',
  DashboardsPermissionsWrite = 'dashboards.permissions:read',

  FoldersRead = 'folders:read',
  FoldersWrite = 'folders:read',
  FoldersDelete = 'folders:delete',
  FoldersCreate = 'folders:create',
  FoldersPermissionsRead = 'folders.permissions:read',
  FoldersPermissionsWrite = 'folders.permissions:read',
}

export interface Role {
  uid: string;
  name: string;
  displayName: string;
  description: string;
  group: string;
  global: boolean;
  delegatable?: boolean;
  version: number;
  created: string;
  updated: string;
}
