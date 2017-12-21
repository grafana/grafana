import { types } from 'mobx-state-tree';
import { SearchStore } from './SearchStore';
import { ServerStatsStore } from './ServerStatsStore';

export const RootStore = types.model({
  search: types.optional(SearchStore, {
    sections: [],
  }),
  serverStats: types.optional(ServerStatsStore, {
    stats: [],
  }),
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
