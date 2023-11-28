import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';
import { createReducer as createBucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { aliasPatternReducer, queryReducer, initQuery } from './state';
const DatasourceContext = createContext(undefined);
const QueryContext = createContext(undefined);
const RangeContext = createContext(undefined);
export const ElasticsearchProvider = ({ children, onChange, onRunQuery, query, datasource, range, }) => {
    const onStateChange = useCallback((query) => {
        onChange(query);
        onRunQuery();
    }, [onChange, onRunQuery]);
    const reducer = combineReducers({
        query: queryReducer,
        alias: aliasPatternReducer,
        metrics: metricsReducer,
        bucketAggs: createBucketAggsReducer(datasource.timeField),
    });
    const dispatch = useStatelessReducer(
    // timeField is part of the query model, but its value is always set to be the one from datasource settings.
    (newState) => onStateChange(Object.assign(Object.assign(Object.assign({}, query), newState), { timeField: datasource.timeField })), query, reducer);
    const isUninitialized = !query.metrics || !query.bucketAggs || query.query === undefined;
    const [shouldRunInit, setShouldRunInit] = useState(isUninitialized);
    // This initializes the query by dispatching an init action to each reducer.
    // useStatelessReducer will then call `onChange` with the newly generated query
    useEffect(() => {
        if (shouldRunInit && isUninitialized) {
            dispatch(initQuery());
            setShouldRunInit(false);
        }
    }, [shouldRunInit, dispatch, isUninitialized]);
    if (isUninitialized) {
        return null;
    }
    return (React.createElement(DatasourceContext.Provider, { value: datasource },
        React.createElement(QueryContext.Provider, { value: query },
            React.createElement(RangeContext.Provider, { value: range },
                React.createElement(DispatchContext.Provider, { value: dispatch }, children)))));
};
const getHook = (c) => () => {
    const contextValue = useContext(c);
    if (!contextValue) {
        throw new Error('use ElasticsearchProvider first.');
    }
    return contextValue;
};
export const useQuery = getHook(QueryContext);
export const useDatasource = getHook(DatasourceContext);
export const useRange = getHook(RangeContext);
//# sourceMappingURL=ElasticsearchQueryContext.js.map