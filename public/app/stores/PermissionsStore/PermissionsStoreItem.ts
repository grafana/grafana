import { types } from 'mobx-state-tree';

export const PermissionsStoreItem = types
  .model('PermissionsStoreItem', {
    dashboardId: types.optional(types.number, -1),
    permission: types.number,
    permissionName: types.maybe(types.string),
    role: types.maybe(types.string),
    team: types.optional(types.string, ''),
    teamId: types.optional(types.number, 0),
    userEmail: types.optional(types.string, ''),
    userId: types.optional(types.number, 0),
    userLogin: types.optional(types.string, ''),
    inherited: types.maybe(types.boolean),
    sortRank: types.maybe(types.number),
    icon: types.maybe(types.string),
    name: types.maybe(types.string),
    teamAvatarUrl: types.maybe(types.string),
    userAvatarUrl: types.maybe(types.string),
  })
  .actions(self => ({
    updateRole: role => {
      self.role = role;
    },
    updatePermission(permission: number, permissionName: string) {
      self.permission = permission;
      self.permissionName = permissionName;
    },
  }));
