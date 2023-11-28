import { createSelector } from '@reduxjs/toolkit';
import React, { useCallback, useMemo } from 'react';
import { CoreApp } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { getNextRefIdChar } from 'app/core/utils/query';
import { useDispatch, useSelector } from 'app/types';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { QueryEditorRows } from '../query/components/QueryEditorRows';
import { changeQueries, runQueries } from './state/query';
import { getExploreItemSelector } from './state/selectors';
const makeSelectors = (exploreId) => {
    const exploreItemSelector = getExploreItemSelector(exploreId);
    return {
        getQueries: createSelector(exploreItemSelector, (s) => s.queries),
        getQueryResponse: createSelector(exploreItemSelector, (s) => s.queryResponse),
        getHistory: createSelector(exploreItemSelector, (s) => s.history),
        getEventBridge: createSelector(exploreItemSelector, (s) => s.eventBridge),
        getDatasourceInstanceSettings: createSelector(exploreItemSelector, (s) => { var _a; return getDatasourceSrv().getInstanceSettings((_a = s.datasourceInstance) === null || _a === void 0 ? void 0 : _a.uid); }),
    };
};
export const QueryRows = ({ exploreId }) => {
    const dispatch = useDispatch();
    const { getQueries, getDatasourceInstanceSettings, getQueryResponse, getHistory, getEventBridge } = useMemo(() => makeSelectors(exploreId), [exploreId]);
    const queries = useSelector(getQueries);
    const dsSettings = useSelector(getDatasourceInstanceSettings);
    const queryResponse = useSelector(getQueryResponse);
    const history = useSelector(getHistory);
    const eventBridge = useSelector(getEventBridge);
    const onRunQueries = useCallback(() => {
        dispatch(runQueries({ exploreId }));
    }, [dispatch, exploreId]);
    const onChange = useCallback((newQueries) => {
        dispatch(changeQueries({ exploreId, queries: newQueries }));
    }, [dispatch, exploreId]);
    const onAddQuery = useCallback((query) => {
        onChange([...queries, Object.assign(Object.assign({}, query), { refId: getNextRefIdChar(queries) })]);
    }, [onChange, queries]);
    const onQueryCopied = () => {
        reportInteraction('grafana_explore_query_row_copy');
    };
    const onQueryRemoved = () => {
        reportInteraction('grafana_explore_query_row_remove');
    };
    const onQueryToggled = (queryStatus) => {
        reportInteraction('grafana_query_row_toggle', queryStatus === undefined ? {} : { queryEnabled: queryStatus });
    };
    return (React.createElement(QueryEditorRows, { dsSettings: dsSettings, queries: queries, onQueriesChange: onChange, onAddQuery: onAddQuery, onRunQueries: onRunQueries, onQueryCopied: onQueryCopied, onQueryRemoved: onQueryRemoved, onQueryToggled: onQueryToggled, data: queryResponse, app: CoreApp.Explore, history: history, eventBus: eventBridge }));
};
//# sourceMappingURL=QueryRows.js.map