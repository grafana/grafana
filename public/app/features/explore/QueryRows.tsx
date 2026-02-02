import { createSelector } from '@reduxjs/toolkit';
// BMC Code : Accessibility Change ( Next 1 lines | useRef added)
import { useCallback, useMemo, useRef, useEffect } from 'react';

import { CoreApp, getNextRefId } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { useDispatch, useSelector } from 'app/types';

import { getDatasourceSrv } from '../plugins/datasource_srv';
import { QueryEditorRows } from '../query/components/QueryEditorRows';

import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
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

  // BMC Code : Accessibility Change start here | useCallback hook modified for new added query & setTimeout to focus newly added row after short delay.
  const queryRowsRef = useRef<HTMLDivElement>(null);
  const newQueryAdded = useRef<boolean>(false);

  const onChange = useCallback(
    (newQueries: DataQuery[]) => {
      dispatch(changeQueries({ exploreId, queries: newQueries }));
      newQueryAdded.current = true;
    },
    [dispatch, exploreId]
  );

  const onAddQuery = useCallback(
    (query: DataQuery) => {
      onChange([...queries, { ...query, refId: getNextRefId(queries) }]);
    },
    [onChange, queries]
  );

  useEffect(() => {
    if (newQueryAdded.current) {
      const lastQueryRow = queryRowsRef.current?.lastElementChild as HTMLElement;
      const inputField = lastQueryRow.querySelector('div') as HTMLElement;
      inputField?.focus();
      newQueryAdded.current = false;
    }
  }, [queries]);
  // BMC Code : Accessibility Change ends here.
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
    // BMC Code : Accessibility Change ( Next 1 lines | Div container added)
    <div ref={queryRowsRef} tabIndex={0} role="button">
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
    </div>
    // BMC Code : Accessibility Change ( Above 1 lines )
  );
};
