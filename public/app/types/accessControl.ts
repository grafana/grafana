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

  OrgUsersRead = 'org.users:read',
  OrgUsersAdd = 'org.users:add',
  OrgUsersRemove = 'org.users:remove',
  OrgUsersRoleUpdate = 'org.users.role:update',

  LDAPUsersRead = 'ldap.user:read',
  LDAPUsersSync = 'ldap.user:sync',
  LDAPStatusRead = 'ldap.status:read',
  DataSourcesExplore = 'datasources:explore',
}
