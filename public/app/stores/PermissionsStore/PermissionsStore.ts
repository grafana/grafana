import { types, getEnv, flow } from 'mobx-state-tree';
import { PermissionsStoreItem } from './PermissionsStoreItem';

const duplicateError = 'This permission exists already.';

export const permissionOptions = [{ value: 1, text: 'View' }, { value: 2, text: 'Edit' }, { value: 4, text: 'Admin' }];

export const aclTypes = [
  { value: 'Group', text: 'Team' },
  { value: 'User', text: 'User' },
  { value: 'Viewer', text: 'Everyone With Viewer Role' },
  { value: 'Editor', text: 'Everyone With Editor Role' },
];

const defaultNewType = aclTypes[0].value;

export const PermissionsStore = types
  .model('PermissionsStore', {
    fetching: types.boolean,
    isFolder: types.maybe(types.boolean),
    dashboardId: types.maybe(types.number),
    canUpdate: types.boolean,
    items: types.optional(types.array(PermissionsStoreItem), []),
    error: types.maybe(types.string),
    originalItems: types.optional(types.array(PermissionsStoreItem), []),
    newType: types.optional(types.string, defaultNewType),
  })
  .views(self => ({
    isValid: item => {
      const dupe = self.items.find(it => {
        return isDuplicate(it, item);
      });

      if (dupe) {
        self.error = duplicateError;
        return false;
      }

      return true;
    },
  }))
  .actions(self => ({
    load: flow(function* load(dashboardId: number, isFolder: boolean) {
      const backendSrv = getEnv(self).backendSrv;
      self.fetching = true;
      self.isFolder = isFolder;
      self.dashboardId = dashboardId;
      const res = yield backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`);
      const items = prepareServerResponse(res, dashboardId, isFolder);
      self.items = items;
      self.originalItems = items;
      self.fetching = false;
    }),
    addStoreItem: item => {
      self.error = null;
      if (!self.isValid(item)) {
        return;
      }

      self.items.push(prepareItem(item, self.dashboardId, self.isFolder));
      self.canUpdate = true;
    },
    removeStoreItem: idx => {
      self.error = null;
      self.items.splice(idx, 1);
      self.canUpdate = true;
    },
    updatePermissionOnIndex(idx: number, permission: number, permissionName: string) {
      self.error = null;
      self.items[idx].updatePermission(permission, permissionName);
      self.canUpdate = true;
    },
    setNewType(newType: string) {
      self.newType = newType;
    },
    resetNewType() {
      self.newType = defaultNewType;
    },
    update: flow(function* update(dashboardId: number) {
      self.error = null;
      const backendSrv = getEnv(self).backendSrv;
      const updated = [];
      for (let item of self.items) {
        if (item.inherited) {
          continue;
        }
        updated.push({
          id: item.id,
          userId: item.userId,
          teamId: item.teamId,
          role: item.role,
          permission: item.permission,
        });
      }

      let res;
      try {
        res = backendSrv.post(`/api/dashboards/id/${dashboardId}/acl`, {
          items: updated,
        });
      } catch (error) {
        console.error(error);
      }

      self.canUpdate = false;
      return res;
    }),
  }));

const prepareServerResponse = (response, dashboardId: number, isFolder: boolean) => {
  return response.map(item => {
    return prepareItem(item, dashboardId, isFolder);
  });
};

const prepareItem = (item, dashboardId: number, isFolder: boolean) => {
  item.inherited = !isFolder && dashboardId !== item.dashboardId;

  item.sortRank = 0;
  if (item.userId > 0) {
    item.icon = 'fa fa-fw fa-user';
    // TODO: Check what sce.trustAsHtml did
    //   item.nameHtml = this.$sce.trustAsHtml(item.userLogin);
    item.nameHtml = item.userLogin;
    item.sortName = item.userLogin;
    item.sortRank = 10;
  } else if (item.teamId > 0) {
    item.icon = 'fa fa-fw fa-users';
    //   item.nameHtml = this.$sce.trustAsHtml(item.team);
    item.nameHtml = item.team;
    item.sortName = item.team;
    item.sortRank = 20;
  } else if (item.role) {
    item.icon = 'fa fa-fw fa-street-view';
    //   item.nameHtml = this.$sce.trustAsHtml(`Everyone with <span class="query-keyword">${item.role}</span> Role`);
    item.nameHtml = `Everyone with <span class="query-keyword">${item.role}</span> Role`;
    item.sortName = item.role;
    item.sortRank = 30;
    if (item.role === 'Viewer') {
      item.sortRank += 1;
    }
  }

  if (item.inherited) {
    item.sortRank += 100;
  }
  return item;
};

const isDuplicate = (origItem, newItem) => {
  if (origItem.inherited) {
    return false;
  }

  return (
    (origItem.role && newItem.role && origItem.role === newItem.role) ||
    (origItem.userId && newItem.userId && origItem.userId === newItem.userId) ||
    (origItem.teamId && newItem.teamId && origItem.teamId === newItem.teamId)
  );
};
