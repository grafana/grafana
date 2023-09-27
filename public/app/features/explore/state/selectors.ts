import { createSelector } from '@reduxjs/toolkit';

import { ExploreItemState, StoreState } from 'app/types';

export const selectPanes = (state: Pick<StoreState, 'explore'>) => state.explore.panes;

export const selectPanesEntries = createSelector<
  [(state: Pick<StoreState, 'explore'>) => Record<string, ExploreItemState | undefined>],
  Array<[string, ExploreItemState]>
>(selectPanes, Object.entries);

export const isSplit = createSelector(selectPanesEntries, (panes) => panes.length > 1);

export const getExploreItemSelector = (exploreId: string) => createSelector(selectPanes, (panes) => panes[exploreId]);
