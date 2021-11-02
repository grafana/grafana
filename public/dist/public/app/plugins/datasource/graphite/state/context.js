import { __assign, __read } from "tslib";
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createStore } from './store';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { actions } from './actions';
import { usePrevious } from 'react-use';
var DispatchContext = createContext({});
var GraphiteStateContext = createContext({});
export var useDispatch = function () {
    return useContext(DispatchContext);
};
export var useGraphiteState = function () {
    return useContext(GraphiteStateContext);
};
export var GraphiteQueryEditorContext = function (_a) {
    var datasource = _a.datasource, onRunQuery = _a.onRunQuery, onChange = _a.onChange, query = _a.query, queries = _a.queries, range = _a.range, children = _a.children;
    var _b = __read(useState(), 2), state = _b[0], setState = _b[1];
    var dispatch = useMemo(function () {
        return createStore(function (state) {
            setState(state);
        });
    }, []);
    // synchronise changes provided in props with editor's state
    var previousRange = usePrevious(range);
    useEffect(function () {
        if ((previousRange === null || previousRange === void 0 ? void 0 : previousRange.raw) !== (range === null || range === void 0 ? void 0 : range.raw)) {
            dispatch(actions.timeRangeChanged(range));
        }
    }, [dispatch, range, previousRange]);
    useEffect(function () {
        if (state) {
            dispatch(actions.queriesChanged(queries));
        }
    }, 
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, queries]);
    useEffect(function () {
        var _a;
        if (state && ((_a = state.target) === null || _a === void 0 ? void 0 : _a.target) !== query.target) {
            dispatch(actions.queryChanged(query));
        }
    }, 
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, query]);
    if (!state) {
        dispatch(actions.init({
            target: query,
            datasource: datasource,
            range: range,
            templateSrv: getTemplateSrv(),
            // list of queries is passed only when the editor is in Dashboards. This is to allow interpolation
            // of sub-queries which are stored in "targetFull" property used by alerting in the backend.
            queries: queries || [],
            refresh: function (target) {
                onChange(__assign(__assign({}, query), { target: target }));
                onRunQuery();
            },
        }));
        return null;
    }
    else {
        return (React.createElement(GraphiteStateContext.Provider, { value: state },
            React.createElement(DispatchContext.Provider, { value: dispatch }, children)));
    }
};
//# sourceMappingURL=context.js.map