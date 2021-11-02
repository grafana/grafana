import { __assign } from "tslib";
import React, { createContext, useCallback, useContext } from 'react';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';
import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { createReducer as createBucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { aliasPatternReducer, queryReducer, initQuery } from './state';
var DatasourceContext = createContext(undefined);
var QueryContext = createContext(undefined);
var RangeContext = createContext(undefined);
export var ElasticsearchProvider = function (_a) {
    var children = _a.children, onChange = _a.onChange, onRunQuery = _a.onRunQuery, query = _a.query, datasource = _a.datasource, range = _a.range;
    var onStateChange = useCallback(function (query) {
        onChange(query);
        onRunQuery();
    }, [onChange, onRunQuery]);
    var reducer = combineReducers({
        query: queryReducer,
        alias: aliasPatternReducer,
        metrics: metricsReducer,
        bucketAggs: createBucketAggsReducer(datasource.timeField),
    });
    var dispatch = useStatelessReducer(
    // timeField is part of the query model, but its value is always set to be the one from datasource settings.
    function (newState) { return onStateChange(__assign(__assign(__assign({}, query), newState), { timeField: datasource.timeField })); }, query, reducer);
    // This initializes the query by dispatching an init action to each reducer.
    // useStatelessReducer will then call `onChange` with the newly generated query
    if (!query.metrics || !query.bucketAggs || query.query === undefined) {
        dispatch(initQuery());
        return null;
    }
    return (React.createElement(DatasourceContext.Provider, { value: datasource },
        React.createElement(QueryContext.Provider, { value: query },
            React.createElement(RangeContext.Provider, { value: range },
                React.createElement(DispatchContext.Provider, { value: dispatch }, children)))));
};
var getHook = function (c) { return function () {
    var contextValue = useContext(c);
    if (!contextValue) {
        throw new Error('use ElasticsearchProvider first.');
    }
    return contextValue;
}; };
export var useQuery = getHook(QueryContext);
export var useDatasource = getHook(DatasourceContext);
export var useRange = getHook(RangeContext);
//# sourceMappingURL=ElasticsearchQueryContext.js.map