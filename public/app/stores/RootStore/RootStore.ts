import { types } from 'mobx-state-tree';
import { SearchStore } from './../SearchStore/SearchStore';
import { ServerStatsStore } from './../ServerStatsStore/ServerStatsStore';
import { NavStore } from './../NavStore/NavStore';
import { AlertListStore } from './../AlertListStore/AlertListStore';
import { ViewStore } from './../ViewStore/ViewStore';
import { FolderStore } from './../FolderStore/FolderStore';
import { PermissionsStore } from './../PermissionsStore/PermissionsStore';
import { TeamsStore } from './../TeamsStore/TeamsStore';

export const RootStore = types.model({
  search: types.optional(SearchStore, {
    sections: [],
  }),
  serverStats: types.optional(ServerStatsStore, {
    stats: [],
  }),
  nav: types.optional(NavStore, {}),
  alertList: types.optional(AlertListStore, {
    rules: [],
  }),
  permissions: types.optional(PermissionsStore, {
    fetching: false,
    items: [],
  }),
  view: types.optional(ViewStore, {
    path: '',
    query: {},
    routeParams: {},
  }),
  folder: types.optional(FolderStore, {}),
  teams: types.optional(TeamsStore, {
    map: {},
  }),
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
