import { ExploreId, StoreState } from 'app/types';

export const isSplit = (state: StoreState) => Boolean(state.explore[ExploreId.left] && state.explore[ExploreId.right]);

export const getExploreItemSelector = (exploreId: ExploreId) => (state: StoreState) => state.explore[exploreId];
