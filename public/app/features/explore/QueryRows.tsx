import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useMemo, useState, Fragment, useEffect } from 'react';

import { CoreApp, getNextRefId } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Modal } from '@grafana/ui';
import { t } from '@grafana/ui/src/utils/i18n';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { useDispatch, useSelector } from 'app/types';

import { getDatasourceSrv } from '../plugins/datasource_srv';
import { RowActionComponents } from '../query/components/QueryActionComponent';
import { QueryEditorRows } from '../query/components/QueryEditorRows';

import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { AddToLibraryForm } from './QueryLibrary/AddToLibraryForm';
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
  };
};

export const QueryRows = ({ exploreId }: Props) => {
  const dispatch = useDispatch();
  const [openAddQLRefId, setOpenAddQLRefId] = useState<string | undefined>(undefined);
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
    dispatch(runQueries({ exploreId }));
  }, [dispatch, exploreId]);

  const onChange = useCallback(
    (newQueries: DataQuery[]) => {
      dispatch(changeQueries({ exploreId, queries: newQueries }));
    },
    [dispatch, exploreId]
  );

  const onAddQuery = useCallback(
    (query: DataQuery) => {
      onChange([...queries, { ...query, refId: getNextRefId(queries) }]);
    },
    [onChange, queries]
  );

  const hasQueryLibrary = config.featureToggles.queryLibrary || false;

  useEffect(() => {
    RowActionComponents.addExtraRenderAction((props) =>
      hasQueryLibrary ? (
        <QueryOperationAction
          title={t('query-operation.header.save-to-query-library', 'Save to query library')}
          icon="save"
          onClick={() => onBeginQLSave(props.query?.refId)}
        />
      ) : null
    );
  }, [hasQueryLibrary]);

  const onQueryCopied = () => {
    reportInteraction('grafana_explore_query_row_copy');
  };

  const onQueryRemoved = () => {
    reportInteraction('grafana_explore_query_row_remove');
  };

  const onQueryToggled = (queryStatus?: boolean) => {
    reportInteraction('grafana_query_row_toggle', queryStatus === undefined ? {} : { queryEnabled: queryStatus });
  };

  const onBeginQLSave = (refId?: string) => {
    if (refId !== undefined) {
      setOpenAddQLRefId(refId);
    }
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
      queryRowWrapper={(children, refId) => {
        const query = queries.find((q) => q.refId === refId);
        return (
          <Fragment key={refId}>
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
            {query !== undefined && (
              <Modal
                title={t('explore.add-to-library-modal.title', 'Add query to Query Library')}
                isOpen={openAddQLRefId === refId}
                onDismiss={() => setOpenAddQLRefId(undefined)}
              >
                <AddToLibraryForm
                  onCancel={() => {
                    setOpenAddQLRefId(undefined);
                  }}
                  onSave={(isSuccess) => {
                    if (isSuccess) {
                      setOpenAddQLRefId(undefined);
                    }
                  }}
                  query={query}
                />
              </Modal>
            )}
          </Fragment>
        );
      }}
    />
  );
};
