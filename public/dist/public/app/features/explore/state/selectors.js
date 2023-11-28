import { createSelector } from '@reduxjs/toolkit';
export const selectPanes = (state) => state.explore.panes;
export const selectExploreRoot = (state) => state.explore;
export const selectPanesEntries = createSelector(selectPanes, Object.entries);
export const isSplit = createSelector(selectPanesEntries, (panes) => panes.length > 1);
export const isLeftPaneSelector = (exploreId) => createSelector(selectPanes, (panes) => {
    return Object.keys(panes)[0] === exploreId;
});
export const getExploreItemSelector = (exploreId) => createSelector(selectPanes, (panes) => panes[exploreId]);
export const selectCorrelationDetails = createSelector(selectExploreRoot, (state) => state.correlationEditorDetails);
//# sourceMappingURL=selectors.js.map