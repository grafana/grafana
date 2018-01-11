import { types, getEnv, flow } from 'mobx-state-tree';
import { PermissionsStoreItem } from './PermissionsStoreItem';

export const PermissionsStore = types
  .model('PermissionsStore', {
    fetching: types.boolean,
    canUpdate: types.boolean,
    items: types.optional(types.array(PermissionsStoreItem), []),
    originalItems: types.optional(types.array(PermissionsStoreItem), []),
  })
  //   .views(self => ({
  //     canUpdate: () => {
  //         const itemsSnapshot = getSnapshot(self.items);
  //         const originalItemsSnapshot = getSnapshot(self.originalItems);
  //         console.log('itemsSnapshot', itemsSnapshot);
  //         console.log('editItemsSnapshot', originalItemsSnapshot);
  //         return true;
  //     }
  //   }))
  .actions(self => ({
    load: flow(function* load(dashboardId: number) {
      self.fetching = true;
      const backendSrv = getEnv(self).backendSrv;
      const res = yield backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`);
      const items = prepareServerResponse(res, dashboardId);
      self.items = items;
      self.originalItems = items;
      self.fetching = false;
    }),
    addStoreItem: () => {
      self.canUpdate = true;
    },
    removeStoreItem: idx => {
      self.items.splice(idx, 1);
      self.canUpdate = true;
    },
  }));

const prepareServerResponse = (response, dashboardId: number) => {
  return response.map(item => {
    // TODO: this.meta
    // item.inherited = !this.meta.isFolder && this.dashboardId !== item.dashboardId;
    item.inherited = dashboardId !== item.dashboardId;
    item.sortRank = 0;
    if (item.userId > 0) {
      item.icon = 'fa fa-fw fa-user';
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
  });
};
