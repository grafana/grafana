import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';

import { CoreApp, getNextRefId } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { type ExploreItemState } from 'app/types/explore';
import { useDispatch, useSelector } from 'app/types/store';

import { QueryEditorRows } from '../query/components/QueryEditorRows';

import { ContentOutlineItem, QUERIES_PANEL_ID } from './ContentOutline/ContentOutlineItem';
import { changeDatasource } from './state/datasource';
import { setAddingSavedQueryAction, updateEditSavedQueryRefAction } from './state/explorePane';
import { changeQueries, runQueries } from './state/query';
import { getExploreItemSelector } from './state/selectors';

interface Props {
  exploreId: string;
  changeCompactMode: (compact: boolean) => void;
  isOpen?: boolean;
}

const makeSelectors = (exploreId: string) => {
  const exploreItemSelector = getExploreItemSelector(exploreId);
  return {
    getQueries: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.queries),
    getQueryResponse: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.queryResponse),
    getHistory: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.history),
    getEventBridge: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.eventBridge),
    getDatasourceUid: createSelector(
      exploreItemSelector,
      (s: ExploreItemState | undefined) => s!.datasourceInstance?.uid
    ),
    getEditSavedQueryRef: createSelector(exploreItemSelector, (s) => s!.editSavedQueryRef),
    getAddingSavedQuery: createSelector(exploreItemSelector, (s) => s!.addingSavedQuery),
  };
};

export const QueryRows = ({ exploreId, isOpen, changeCompactMode }: Props) => {
  const dispatch = useDispatch();
  const {
    getQueries,
    getDatasourceUid,
    getQueryResponse,
    getHistory,
    getEventBridge,
    getEditSavedQueryRef,
    getAddingSavedQuery,
  } = useMemo(() => makeSelectors(exploreId), [exploreId]);

  const queries = useSelector(getQueries);
  const datasourceUid = useSelector(getDatasourceUid);
  const { settings: dsSettings } = useDataSourceInstanceSettings(datasourceUid);
  const queryResponse = useSelector(getQueryResponse);
  const history = useSelector(getHistory);
  const eventBridge = useSelector(getEventBridge);
  const editSavedQueryRef = useSelector(getEditSavedQueryRef);
  const addingSavedQuery = useSelector(getAddingSavedQuery);

  const onRunQueries = useCallback(() => {
    dispatch(runQueries({ exploreId }));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    (newQueries: DataQuery[], options?: { skipAutoImport?: boolean }) => {
      dispatch(changeQueries({ exploreId, queries: newQueries, options }));
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

  const onExitQueryLibraryEdit = useCallback(
    () => dispatch(updateEditSavedQueryRefAction({ exploreId, editSavedQueryRef: undefined })),
    [dispatch, exploreId]
  );

  const onCancelAddSavedQuery = useCallback(() => {
    dispatch(setAddingSavedQueryAction({ exploreId, addingSavedQuery: false }));
  }, [dispatch, exploreId]);

  const onQueryOpenChanged = () => {
    // Disables compact mode when query is opened.
    // Compact mode can also be disabled by opening Content Outline.
    changeCompactMode(false);
  };

  // QueryEditorRows dereferences dsSettings unconditionally, so it cannot mount without them.
  // Only the first resolution can leave us with nothing to render: a later datasource switch keeps
  // serving the previous settings while the next lookup is in flight, so the editors stay mounted
  // instead of being torn down and rebuilt. Both windows are a microtask — too short for a spinner.
  if (!dsSettings) {
    return null;
  }

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
      onQueryOpenChanged={onQueryOpenChanged}
      data={queryResponse}
      app={CoreApp.Explore}
      history={history}
      eventBus={eventBridge}
      editSavedQueryRef={editSavedQueryRef}
      onExitQueryLibraryEdit={onExitQueryLibraryEdit}
      addingSavedQuery={addingSavedQuery}
      onCancelAddSavedQuery={onCancelAddSavedQuery}
      isOpen={isOpen}
      queryRowWrapper={(children, refId) => (
        <ContentOutlineItem
          title={refId}
          icon="arrow"
          key={refId}
          panelId={QUERIES_PANEL_ID}
          customTopOffset={-10}
          level="child"
        >
          {children}
        </ContentOutlineItem>
      )}
    />
  );
};
