import { ExploreId, StoreState } from 'app/types';

export const isSplit = (state: StoreState) => Boolean(state.explore[ExploreId.left] && state.explore[ExploreId.right]);
