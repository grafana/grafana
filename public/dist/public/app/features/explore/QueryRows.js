import { __assign, __read, __spreadArray } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { runQueries, changeQueriesAction } from './state/query';
import { CoreApp } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { QueryEditorRows } from '../query/components/QueryEditorRows';
import { createSelector } from '@reduxjs/toolkit';
import { getExploreItemSelector } from './state/selectors';
var makeSelectors = function (exploreId) {
    var exploreItemSelector = getExploreItemSelector(exploreId);
    return {
        getQueries: createSelector(exploreItemSelector, function (s) { return s.queries; }),
        getQueryResponse: createSelector(exploreItemSelector, function (s) { return s.queryResponse; }),
        getHistory: createSelector(exploreItemSelector, function (s) { return s.history; }),
        getEventBridge: createSelector(exploreItemSelector, function (s) { return s.eventBridge; }),
        getDatasourceInstanceSettings: createSelector(exploreItemSelector, function (s) { var _a; return getDatasourceSrv().getInstanceSettings((_a = s.datasourceInstance) === null || _a === void 0 ? void 0 : _a.uid); }),
    };
};
export var QueryRows = function (_a) {
    var exploreId = _a.exploreId;
    var dispatch = useDispatch();
    var _b = useMemo(function () { return makeSelectors(exploreId); }, [exploreId]), getQueries = _b.getQueries, getDatasourceInstanceSettings = _b.getDatasourceInstanceSettings, getQueryResponse = _b.getQueryResponse, getHistory = _b.getHistory, getEventBridge = _b.getEventBridge;
    var queries = useSelector(getQueries);
    var dsSettings = useSelector(getDatasourceInstanceSettings);
    var queryResponse = useSelector(getQueryResponse);
    var history = useSelector(getHistory);
    var eventBridge = useSelector(getEventBridge);
    var onRunQueries = useCallback(function () {
        dispatch(runQueries(exploreId));
    }, [dispatch, exploreId]);
    var onChange = useCallback(function (newQueries) {
        dispatch(changeQueriesAction({ queries: newQueries, exploreId: exploreId }));
        // if we are removing a query we want to run the remaining ones
        if (newQueries.length < queries.length) {
            onRunQueries();
        }
    }, [dispatch, exploreId, onRunQueries, queries]);
    var onAddQuery = useCallback(function (query) {
        onChange(__spreadArray(__spreadArray([], __read(queries), false), [__assign(__assign({}, query), { refId: getNextRefIdChar(queries) })], false));
    }, [onChange, queries]);
    return (React.createElement(QueryEditorRows, { dsSettings: dsSettings, queries: queries, onQueriesChange: onChange, onAddQuery: onAddQuery, onRunQueries: onRunQueries, data: queryResponse, app: CoreApp.Explore, history: history, eventBus: eventBridge }));
};
//# sourceMappingURL=QueryRows.js.map