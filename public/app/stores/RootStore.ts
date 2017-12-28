import { types } from 'mobx-state-tree';
import { SearchStore } from './SearchStore';
import { ServerStatsStore } from './ServerStatsStore';
import { NavStore } from './NavStore';
import { AlertingStore } from './AlertingStore';

export const RootStore = types.model({
  search: types.optional(SearchStore, {
    sections: [],
  }),
  serverStats: types.optional(ServerStatsStore, {
    stats: [],
  }),
  nav: types.optional(NavStore, {}),
  alerting: types.optional(AlertingStore, {
    rules: [],
  }),
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
