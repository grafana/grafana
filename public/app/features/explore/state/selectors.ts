import { ExploreId, StoreState } from 'app/types';

export const isSplit = (state: StoreState) => Object.keys(state.explore.panes).length > 1;

export const getExploreItemSelector = (exploreId: ExploreId) => (state: StoreState) => state.explore.panes[exploreId];
