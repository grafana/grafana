import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';

import { CoreApp, getNextRefId } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { useDispatch, useSelector } from 'app/types/store';

import { getDatasourceSrv } from '../plugins/datasource_srv';
import { QueryEditorRows } from '../query/components/QueryEditorRows';

import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { changeDatasource } from './state/datasource';
import { updateQueryLibraryRefAction } from './state/explorePane';
import { changeQueries, runQueries } from './state/query';
import { getExploreItemSelector } from './state/selectors';

interface Props {
  exploreId: string;
}

const makeSelectors = (exploreId: string) => {
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
    getQueryLibraryRef: createSelector(exploreItemSelector, (s) => s!.queryLibraryRef),
  };
};

export const QueryRows = ({ exploreId }: Props) => {
  const dispatch = useDispatch();
  const {
    getQueries,
    getDatasourceInstanceSettings,
    getQueryResponse,
    getHistory,
    getEventBridge,
    getQueryLibraryRef,
  } = useMemo(() => makeSelectors(exploreId), [exploreId]);

  const queries = useSelector(getQueries);
  const dsSettings = useSelector(getDatasourceInstanceSettings);
  const queryResponse = useSelector(getQueryResponse);
  const history = useSelector(getHistory);
  const eventBridge = useSelector(getEventBridge);
  const queryLibraryRef = useSelector(getQueryLibraryRef);

  const onRunQueries = useCallback(() => {
    dispatch(runQueries({ exploreId }));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    (newQueries: DataQuery[]) => {
      dispatch(changeQueries({ exploreId, queries: newQueries }));
    },
    [dispatch, exploreId]
  );

  const onUpdateDatasources = useCallback(
    (datasource: DataSourceRef) => {
      dispatch(changeDatasource({ exploreId, datasource }));
    },
    [dispatch, exploreId]
  );

  const onAddQuery = useCallback(
    (query: DataQuery) => {
      onChange([...queries, { ...query, refId: getNextRefId(queries) }]);
    },
    [onChange, queries]
  );

  const onQueryCopied = () => {
    reportInteraction('grafana_explore_query_row_copy');
  };

  const onQueryReplacedFromLibrary = () => {
    reportInteraction('grafana_explore_query_replaced_from_library');
  };

  const onQueryRemoved = () => {
    reportInteraction('grafana_explore_query_row_remove');
  };

  const onQueryToggled = (queryStatus?: boolean) => {
    reportInteraction('grafana_query_row_toggle', queryStatus === undefined ? {} : { queryEnabled: queryStatus });
  };

  const onCancelQueryLibraryEdit = () => {
    dispatch(updateQueryLibraryRefAction({ exploreId, queryLibraryRef: undefined }));
  };

  return (
    <QueryEditorRows
      dsSettings={dsSettings}
      queries={queries}
      onQueriesChange={onChange}
      onUpdateDatasources={onUpdateDatasources}
      onAddQuery={onAddQuery}
      onRunQueries={onRunQueries}
      onQueryCopied={onQueryCopied}
      onQueryRemoved={onQueryRemoved}
      onQueryToggled={onQueryToggled}
      onQueryReplacedFromLibrary={onQueryReplacedFromLibrary}
      data={queryResponse}
      app={CoreApp.Explore}
      history={history}
      eventBus={eventBridge}
      queryLibraryRef={queryLibraryRef}
      onCancelQueryLibraryEdit={onCancelQueryLibraryEdit}
      queryRowWrapper={(children, refId) => (
        <ContentOutlineItem
          title={refId}
          icon="arrow"
          key={refId}
          panelId="Queries"
          customTopOffset={-10}
          level="child"
        >
          {children}
        </ContentOutlineItem>
      )}
    />
  );
};
