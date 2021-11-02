import { ExploreId } from 'app/types';
export var isSplit = function (state) { return Boolean(state.explore[ExploreId.left] && state.explore[ExploreId.right]); };
export var getExploreItemSelector = function (exploreId) { return function (state) { return state.explore[exploreId]; }; };
//# sourceMappingURL=selectors.js.map