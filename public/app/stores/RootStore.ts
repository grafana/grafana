import { types } from 'mobx-state-tree';
import { SearchStore } from './SearchStore';
import { ServerStatsStore } from './ServerStatsStore';
import { NavStore } from './NavStore/NavStore';

export const RootStore = types.model({
  search: types.optional(SearchStore, {
    sections: [],
  }),
  serverStats: types.optional(ServerStatsStore, {
    stats: [],
  }),
  nav: types.optional(NavStore, {}),
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
