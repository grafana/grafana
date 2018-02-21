import { types, getEnv, flow } from 'mobx-state-tree';
import { PermissionsStoreItem } from './PermissionsStoreItem';

const duplicateError = 'This permission exists already.';

export const permissionOptions = [
  { value: 1, label: 'View', description: 'Can view dashboards.' },
  { value: 2, label: 'Edit', description: 'Can add, edit and delete dashboards.' },
  {
    value: 4,
    label: 'Admin',
    description: 'Can add/remove permissions and can add, edit and delete dashboards.',
  },
];

export const aclTypeValues = {
  GROUP: { value: 'Group', text: 'Team' },
  USER: { value: 'User', text: 'User' },
  VIEWER: { value: 'Viewer', text: 'Everyone With Viewer Role' },
  EDITOR: { value: 'Editor', text: 'Everyone With Editor Role' },
};

export const aclTypes = Object.keys(aclTypeValues).map(item => aclTypeValues[item]);

const defaultNewType = aclTypes[0].value;

export const NewPermissionsItem = types
  .model('NewPermissionsItem', {
    type: types.optional(
      types.enumeration(Object.keys(aclTypeValues).map(item => aclTypeValues[item].value)),
      defaultNewType
    ),
    userId: types.maybe(types.number),
    userLogin: types.maybe(types.string),
    teamId: types.maybe(types.number),
    team: types.maybe(types.string),
    permission: types.optional(types.number, 1),
  })
  .views(self => ({
    isValid: () => {
      switch (self.type) {
        case aclTypeValues.GROUP.value:
          return self.teamId && self.team;
        case aclTypeValues.USER.value:
          return !!self.userId && !!self.userLogin;
        case aclTypeValues.VIEWER.value:
        case aclTypeValues.EDITOR.value:
          return true;
        default:
          return false;
      }
    },
  }))
  .actions(self => ({
    setUser(userId: number, userLogin: string) {
      self.userId = userId;
      self.userLogin = userLogin;
      self.teamId = null;
      self.team = null;
    },
    setTeam(teamId: number, team: string) {
      self.userId = null;
      self.userLogin = null;
      self.teamId = teamId;
      self.team = team;
    },
    setPermission(permission: number) {
      self.permission = permission;
    },
  }));

export const PermissionsStore = types
  .model('PermissionsStore', {
    fetching: types.boolean,
    isFolder: types.maybe(types.boolean),
    dashboardId: types.maybe(types.number),
    items: types.optional(types.array(PermissionsStoreItem), []),
    error: types.maybe(types.string),
    originalItems: types.optional(types.array(PermissionsStoreItem), []),
    newType: types.optional(types.string, defaultNewType),
    newItem: types.maybe(NewPermissionsItem),
    isAddPermissionsVisible: types.optional(types.boolean, false),
    isInRoot: types.maybe(types.boolean),
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
  .actions(self => {
    const resetNewType = () => {
      self.error = null;
      self.newItem = NewPermissionsItem.create();
    };

    return {
      load: flow(function* load(dashboardId: number, isFolder: boolean, isInRoot: boolean) {
        const backendSrv = getEnv(self).backendSrv;
        self.fetching = true;
        self.isFolder = isFolder;
        self.isInRoot = isInRoot;
        self.dashboardId = dashboardId;
        self.items.clear();

        const res = yield backendSrv.get(`/api/dashboards/id/${dashboardId}/permissions`);
        const items = prepareServerResponse(res, dashboardId, isFolder, isInRoot);
        self.items = items;
        self.originalItems = items;
        self.fetching = false;
        self.error = null;
      }),

      addStoreItem: flow(function* addStoreItem() {
        self.error = null;
        let item = {
          type: self.newItem.type,
          permission: self.newItem.permission,
          dashboardId: self.dashboardId,
          team: undefined,
          teamId: undefined,
          userLogin: undefined,
          userId: undefined,
          role: undefined,
        };
        switch (self.newItem.type) {
          case aclTypeValues.GROUP.value:
            item.team = self.newItem.team;
            item.teamId = self.newItem.teamId;
            break;
          case aclTypeValues.USER.value:
            item.userLogin = self.newItem.userLogin;
            item.userId = self.newItem.userId;
            break;
          case aclTypeValues.VIEWER.value:
          case aclTypeValues.EDITOR.value:
            item.role = self.newItem.type;
            break;
          default:
            throw Error('Unknown type: ' + self.newItem.type);
        }

        if (!self.isValid(item)) {
          return undefined;
        }

        self.items.push(prepareItem(item, self.dashboardId, self.isFolder, self.isInRoot));
        resetNewType();
        return updateItems(self);
      }),

      removeStoreItem: flow(function* removeStoreItem(idx: number) {
        self.error = null;
        self.items.splice(idx, 1);
        return updateItems(self);
      }),

      updatePermissionOnIndex: flow(function* updatePermissionOnIndex(
        idx: number,
        permission: number,
        permissionName: string
      ) {
        self.error = null;
        self.items[idx].updatePermission(permission, permissionName);
        return updateItems(self);
      }),

      setNewType(newType: string) {
        self.newItem = NewPermissionsItem.create({ type: newType });
      },

      resetNewType() {
        resetNewType();
      },

      toggleAddPermissions() {
        self.isAddPermissionsVisible = !self.isAddPermissionsVisible;
      },

      hideAddPermissions() {
        self.isAddPermissionsVisible = false;
      },
    };
  });

const updateItems = self => {
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
    res = backendSrv.post(`/api/dashboards/id/${self.dashboardId}/permissions`, {
      items: updated,
    });
  } catch (error) {
    self.error = error;
  }

  return res;
};

const prepareServerResponse = (response, dashboardId: number, isFolder: boolean, isInRoot: boolean) => {
  return response.map(item => {
    return prepareItem(item, dashboardId, isFolder, isInRoot);
  });
};

const prepareItem = (item, dashboardId: number, isFolder: boolean, isInRoot: boolean) => {
  item.inherited = !isFolder && !isInRoot && dashboardId !== item.dashboardId;

  item.sortRank = 0;
  if (item.userId > 0) {
    item.icon = 'fa fa-fw fa-user';
    item.nameHtml = item.userLogin;
    item.sortName = item.userLogin;
    item.sortRank = 10;
  } else if (item.teamId > 0) {
    item.icon = 'fa fa-fw fa-users';
    item.nameHtml = item.team;
    item.sortName = item.team;
    item.sortRank = 20;
  } else if (item.role) {
    item.icon = 'fa fa-fw fa-street-view';
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
