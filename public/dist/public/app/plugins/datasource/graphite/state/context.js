import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { actions } from './actions';
import { createStore } from './store';
const DispatchContext = createContext({});
const GraphiteStateContext = createContext({});
export const useDispatch = () => {
    return useContext(DispatchContext);
};
export const useGraphiteState = () => {
    return useContext(GraphiteStateContext);
};
export const GraphiteQueryEditorContext = ({ datasource, onRunQuery, onChange, query, queries, range, children, }) => {
    const [state, setState] = useState();
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const dispatch = useMemo(() => {
        return createStore((state) => {
            setState(state);
        });
    }, []);
    // synchronise changes provided in props with editor's state
    const previousRange = usePrevious(range);
    useEffect(() => {
        if (JSON.stringify(previousRange === null || previousRange === void 0 ? void 0 : previousRange.raw) !== JSON.stringify(range === null || range === void 0 ? void 0 : range.raw)) {
            dispatch(actions.timeRangeChanged(range));
        }
    }, [dispatch, range, previousRange]);
    useEffect(() => {
        if (state) {
            dispatch(actions.queriesChanged(queries));
        }
    }, 
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queries)]);
    useEffect(() => {
        var _a;
        if (state && ((_a = state.target) === null || _a === void 0 ? void 0 : _a.target) !== query.target) {
            dispatch(actions.queryChanged(query));
        }
    }, 
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, query]);
    useEffect(() => {
        if (needsRefresh && state) {
            setNeedsRefresh(false);
            onChange(Object.assign(Object.assign({}, query), { target: state.target.target }));
            onRunQuery();
        }
    }, 
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsRefresh, JSON.stringify(query)]);
    if (!state) {
        dispatch(actions.init({
            target: query,
            datasource: datasource,
            range: range,
            templateSrv: getTemplateSrv(),
            // list of queries is passed only when the editor is in Dashboards. This is to allow interpolation
            // of sub-queries which are stored in "targetFull" property used by alerting in the backend.
            queries: queries || [],
            refresh: () => {
                // do not run onChange/onRunQuery straight away to ensure the internal state gets updated first
                // to avoid race conditions (onChange could update props before the reducer action finishes)
                setNeedsRefresh(true);
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