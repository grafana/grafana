/**
 * UserPermission is a map storing permissions in a form of
 * {
 *   action: { scope: scope }
 * }
 */
export type UserPermission = {
  [key: string]: { [key: string]: string };
};

export interface AccessControlPermission {
  action: AccessControlAction;
  scope?: AccessControlScope;
}

// Permission actions
export enum AccessControlAction {
  UsersRead = 'users:read',
  UsersWrite = 'users:write',
  UsersTeamRead = 'users.teams:read',
  UsersAuthTokenList = 'users.authtoken:list',
  UsersAuthTokenUpdate = 'users.authtoken:update',
  UsersPasswordUpdate = 'users.password.update',
  UsersDelete = 'users:delete',
  UsersCreate = 'users:create',
  UsersEnable = 'users:enable',
  UsersDisable = 'users:disable',
  UsersPermissionsUpdate = 'users.permissions.update',
  UsersLogout = 'users:logout',
  UsersQuotasList = 'users.quotas:list',
  UsersQuotasUpdate = 'users.quotas:update',
}

// Global Scopes
export enum AccessControlScope {
  UsersAll = 'users:*',
  UsersSelf = 'users:self',
}
