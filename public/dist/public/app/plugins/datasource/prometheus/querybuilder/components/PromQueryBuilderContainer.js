import { createSlice } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';
import { config } from '@grafana/runtime';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';
import { getSettings } from './metrics-modal/state/state';
const prometheusMetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;
/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props) {
    const { query, onChange, onRunQuery, datasource, data, showExplain } = props;
    const [state, dispatch] = useReducer(stateSlice.reducer, { expr: query.expr });
    // Only rebuild visual query if expr changes from outside
    useEffect(() => {
        var _a, _b, _c, _d;
        dispatch(exprChanged(query.expr));
        if (prometheusMetricEncyclopedia) {
            dispatch(setMetricsModalSettings({
                useBackend: (_a = query.useBackend) !== null && _a !== void 0 ? _a : false,
                disableTextWrap: (_b = query.disableTextWrap) !== null && _b !== void 0 ? _b : false,
                fullMetaSearch: (_c = query.fullMetaSearch) !== null && _c !== void 0 ? _c : false,
                includeNullMetadata: (_d = query.includeNullMetadata) !== null && _d !== void 0 ? _d : true,
            }));
        }
    }, [query]);
    const onVisQueryChange = (visQuery) => {
        const expr = promQueryModeller.renderQuery(visQuery);
        dispatch(visualQueryChange({ visQuery, expr }));
        if (prometheusMetricEncyclopedia) {
            const metricsModalSettings = getSettings(visQuery);
            onChange(Object.assign(Object.assign(Object.assign({}, props.query), { expr: expr }), metricsModalSettings));
        }
        else {
            onChange(Object.assign(Object.assign({}, props.query), { expr: expr }));
        }
    };
    if (!state.visQuery) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(PromQueryBuilder, { query: state.visQuery, datasource: datasource, onChange: onVisQueryChange, onRunQuery: onRunQuery, data: data, showExplain: showExplain }),
        React.createElement(QueryPreview, { query: query.expr })));
}
const initialState = {
    expr: '',
};
const stateSlice = createSlice({
    name: 'prom-builder-container',
    initialState,
    reducers: {
        visualQueryChange: (state, action) => {
            state.expr = action.payload.expr;
            state.visQuery = action.payload.visQuery;
        },
        exprChanged: (state, action) => {
            var _a;
            if (!state.visQuery || state.expr !== action.payload) {
                state.expr = action.payload;
                const parseResult = buildVisualQueryFromString((_a = action.payload) !== null && _a !== void 0 ? _a : '');
                state.visQuery = parseResult.query;
            }
        },
        setMetricsModalSettings: (state, action) => {
            if (state.visQuery && prometheusMetricEncyclopedia) {
                state.visQuery.useBackend = action.payload.useBackend;
                state.visQuery.disableTextWrap = action.payload.disableTextWrap;
                state.visQuery.fullMetaSearch = action.payload.fullMetaSearch;
                state.visQuery.includeNullMetadata = action.payload.includeNullMetadata;
            }
        },
    },
});
const { visualQueryChange, exprChanged, setMetricsModalSettings } = stateSlice.actions;
//# sourceMappingURL=PromQueryBuilderContainer.js.map