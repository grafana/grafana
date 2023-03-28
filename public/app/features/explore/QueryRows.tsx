import { createSelector } from '@reduxjs/toolkit';
import React, { useCallback, useMemo } from 'react';

import { CoreApp } from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { getNextRefIdChar } from 'app/core/utils/query';
import { useDispatch, useSelector } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { getDatasourceSrv } from '../plugins/datasource_srv';
import { QueryEditorRows } from '../query/components/QueryEditorRows';

import { runQueries, changeQueriesAction, importQueries } from './state/query';
import { getExploreItemSelector } from './state/selectors';

interface Props {
  exploreId: ExploreId;
}

const makeSelectors = (exploreId: ExploreId) => {
  const exploreItemSelector = getExploreItemSelector(exploreId);
  return {
    getQueries: createSelector(exploreItemSelector, (s) => s!.queries),
    getQueryResponse: createSelector(exploreItemSelector, (s) => s!.queryResponse),
    getHistory: createSelector(exploreItemSelector, (s) => s!.history),
    getEventBridge: createSelector(exploreItemSelector, (s) => s!.eventBridge),
    getDatasourceInstanceSettings: createSelector(
      exploreItemSelector,
      (s) => getDatasourceSrv().getInstanceSettings(s!.datasourceInstance?.uid)!
    ),
  };
};

export const QueryRows = ({ exploreId }: Props) => {
  const dispatch = useDispatch();
  const { getQueries, getDatasourceInstanceSettings, getQueryResponse, getHistory, getEventBridge } = useMemo(
    () => makeSelectors(exploreId),
    [exploreId]
  );

  const queries = useSelector(getQueries)!;
  const dsSettings = useSelector(getDatasourceInstanceSettings)!;
  const queryResponse = useSelector(getQueryResponse)!;
  const history = useSelector(getHistory);
  const eventBridge = useSelector(getEventBridge);

  const onRunQueries = useCallback(() => {
    dispatch(runQueries(exploreId));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    async (newQueries: DataQuery[]) => {
      dispatch(changeQueriesAction({ queries: newQueries, exploreId }));

      for (const newQuery of newQueries) {
        for (const oldQuery of queries) {
          if (newQuery.refId === oldQuery.refId && newQuery.datasource?.type !== oldQuery.datasource?.type) {
            const queryDatasource = await getDataSourceSrv().get(newQuery.datasource);
            const targetDS = await getDataSourceSrv().get({ uid: newQuery.datasource?.uid });
            dispatch(importQueries(exploreId, queries, queryDatasource, targetDS, newQuery.refId));
          }
        }
      }

      // if we are removing a query we want to run the remaining ones
      if (newQueries.length < queries.length) {
        onRunQueries();
      }
    },
    [dispatch, exploreId, onRunQueries, queries]
  );

  const onAddQuery = useCallback(
    (query: DataQuery) => {
      onChange([...queries, { ...query, refId: getNextRefIdChar(queries) }]);
    },
    [onChange, queries]
  );

  const onQueryCopied = () => {
    reportInteraction('grafana_explore_query_row_copy');
  };

  const onQueryRemoved = () => {
    reportInteraction('grafana_explore_query_row_remove');
  };

  const onQueryToggled = (queryStatus?: boolean) => {
    reportInteraction('grafana_query_row_toggle', queryStatus === undefined ? {} : { queryEnabled: queryStatus });
  };

  return (
    <QueryEditorRows
      dsSettings={dsSettings}
      queries={queries}
      onQueriesChange={onChange}
      onAddQuery={onAddQuery}
      onRunQueries={onRunQueries}
      onQueryCopied={onQueryCopied}
      onQueryRemoved={onQueryRemoved}
      onQueryToggled={onQueryToggled}
      data={queryResponse}
      app={CoreApp.Explore}
      history={history}
      eventBus={eventBridge}
    />
  );
};
