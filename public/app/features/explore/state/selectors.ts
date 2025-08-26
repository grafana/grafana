import { createSelector } from '@reduxjs/toolkit';
import { flatten, uniqBy } from 'lodash';

import { DataSourceRef } from '@grafana/schema';
import { ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types/store';

export const selectPanes = (state: Pick<StoreState, 'explore'>) => state.explore.panes;
export const selectExploreRoot = (state: Pick<StoreState, 'explore'>) => state.explore;

export const selectRichHistorySettings = (state: Pick<StoreState, 'explore'>) => state.explore.richHistorySettings;

export const selectPanesEntries = createSelector<
  [(state: Pick<StoreState, 'explore'>) => Record<string, ExploreItemState | undefined>],
  Array<[string, ExploreItemState]>
>(selectPanes, Object.entries);

export const isSplit = createSelector(selectPanesEntries, (panes) => panes.length > 1);
export const selectIsHelperShowing = createSelector(selectPanesEntries, (panes) =>
  panes.some((pane) => pane[1].correlationEditorHelperData !== undefined)
);

export const isLeftPaneSelector = (exploreId: string) =>
  createSelector(selectPanes, (panes) => {
    return Object.keys(panes)[0] === exploreId;
  });

export const getExploreItemSelector = (exploreId: string) => createSelector(selectPanes, (panes) => panes[exploreId]);

export const selectCorrelationDetails = createSelector(selectExploreRoot, (state) => state.correlationEditorDetails);

export const selectExploreDSMaps = createSelector(selectPanesEntries, (panes) => {
  const exploreDSMap = panes
    .map(([exploreId, pane]) => {
      const rootDatasource = [pane?.datasourceInstance?.getRef()];
      const queryDatasources = pane?.queries.map((q) => q.datasource) || [];
      const datasources = [...rootDatasource, ...queryDatasources].filter(
        (datasource): datasource is DataSourceRef => !!datasource
      );

      if (datasources === undefined || datasources.length === 0) {
        return undefined;
      } else {
        return {
          exploreId,
          datasources: uniqBy(datasources, (ds) => ds.uid),
        };
      }
    })
    .filter((pane): pane is { exploreId: string; datasources: DataSourceRef[] } => !!pane);

  const uniqueDataSources = uniqBy(flatten(exploreDSMap.map((pane) => pane.datasources)), (ds) => ds.uid);

  const dsToExploreMap = uniqueDataSources.map((ds) => {
    let exploreIds: string[] = [];
    exploreDSMap.forEach((eds) => {
      if (eds.datasources.some((edsDs) => edsDs.uid === ds.uid)) {
        exploreIds.push(eds.exploreId);
      }
    });
    return {
      datasource: ds,
      exploreIds: exploreIds,
    };
  });

  return { exploreToDS: exploreDSMap, dsToExplore: dsToExploreMap };
});
