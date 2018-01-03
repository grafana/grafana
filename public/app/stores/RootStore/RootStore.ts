import { types } from 'mobx-state-tree';
import { SearchStore } from './../SearchStore/SearchStore';
import { ServerStatsStore } from './../ServerStatsStore/ServerStatsStore';
import { NavStore } from './../NavStore/NavStore';
import { AlertListStore } from './../AlertListStore/AlertListStore';
import { ViewStore } from './../ViewStore/ViewStore';

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
  view: types.optional(ViewStore, {
    path: '',
    query: {},
  }),
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
