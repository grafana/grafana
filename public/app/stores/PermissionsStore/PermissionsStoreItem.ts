import { types } from 'mobx-state-tree';

export const PermissionsStoreItem = types
  .model('PermissionsStoreItem', {
    dashboardId: types.number,
    id: types.number,
    permission: types.number,
    permissionName: types.string,
    role: types.maybe(types.string),
    team: types.string,
    teamId: types.number,
    userEmail: types.string,
    userId: types.number,
    userLogin: types.string,
    inherited: types.maybe(types.boolean),
    sortRank: types.maybe(types.number),
    icon: types.maybe(types.string),
    nameHtml: types.maybe(types.string),
    sortName: types.maybe(types.string),
  })
  .actions(self => ({
    updateRole: role => {
      self.role = role;
    },
  }));
