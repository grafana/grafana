import { createSelector } from '@reduxjs/toolkit';

import { ExploreState, StoreState } from 'app/types';

export const selectPanes = (state: Pick<StoreState, 'explore'>) => state.explore.panes;

/**
 * Explore renders panes by iterating over the panes object. This selector ensures that entries in the returned panes object
 * are in the correct order.
 */
export const selectOrderedExplorePanes = createSelector(selectPanes, (panes) => {
  const orderedPanes: ExploreState['panes'] = {};

  if (panes.left) {
    orderedPanes.left = panes.left;
  }
  if (panes.right) {
    orderedPanes.right = panes.right;
  }
  return orderedPanes;
});

export const isSplit = createSelector(selectPanes, (panes) => Object.keys(panes).length > 1);

export const getExploreItemSelector = (exploreId: string) => createSelector(selectPanes, (panes) => panes[exploreId]);
