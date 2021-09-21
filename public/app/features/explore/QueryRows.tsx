import React, { useCallback, useMemo } from 'react';
import { ExploreId } from 'app/types/explore';
import { useDispatch, useSelector } from 'react-redux';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { runQueries, changeQueriesAction } from './state/query';
import { CoreApp, DataQuery } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { QueryEditorRows } from '../query/components/QueryEditorRows';
import { createSelector } from '@reduxjs/toolkit';
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
      (s) => getDatasourceSrv().getInstanceSettings(s!.datasourceInstance?.name)!
    ),
  };
};

export const QueryRows = ({ exploreId }: Props) => {
  const dispatch = useDispatch();
  const { getQueries, getDatasourceInstanceSettings, getQueryResponse, getHistory, getEventBridge } = useMemo(
    () => makeSelectors(exploreId),
    [exploreId]
  );

  const queries = useSelector(getQueries);
  const dsSettings = useSelector(getDatasourceInstanceSettings);
  const queryResponse = useSelector(getQueryResponse);
  const history = useSelector(getHistory);
  const eventBridge = useSelector(getEventBridge);

  const onRunQueries = useCallback(() => {
    dispatch(runQueries(exploreId));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    (newQueries: DataQuery[]) => {
      dispatch(changeQueriesAction({ queries: newQueries, exploreId }));

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

  return (
    <QueryEditorRows
      dsSettings={dsSettings}
      queries={queries}
      onQueriesChange={onChange}
      onAddQuery={onAddQuery}
      onRunQueries={onRunQueries}
      data={queryResponse}
      app={CoreApp.Explore}
      history={history}
      eventBus={eventBridge}
    />
  );
};
