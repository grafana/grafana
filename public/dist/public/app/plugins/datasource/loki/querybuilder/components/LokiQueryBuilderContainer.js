import { createSlice } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';
import { testIds } from '../../components/LokiQueryEditor';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiQueryBuilder } from './LokiQueryBuilder';
import { QueryPreview } from './QueryPreview';
/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function LokiQueryBuilderContainer(props) {
    const { query, onChange, onRunQuery, datasource, showExplain } = props;
    const [state, dispatch] = useReducer(stateSlice.reducer, {
        expr: query.expr,
        // Use initial visual query only if query.expr is empty string
        visQuery: query.expr === ''
            ? {
                labels: [],
                operations: [{ id: '__line_contains', params: [''] }],
            }
            : undefined,
    });
    // Only rebuild visual query if expr changes from outside
    useEffect(() => {
        dispatch(exprChanged(query.expr));
    }, [query.expr]);
    const onVisQueryChange = (visQuery) => {
        const expr = lokiQueryModeller.renderQuery(visQuery);
        dispatch(visualQueryChange({ visQuery, expr }));
        onChange(Object.assign(Object.assign({}, props.query), { expr: expr }));
    };
    if (!state.visQuery) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(LokiQueryBuilder, { query: state.visQuery, datasource: datasource, onChange: onVisQueryChange, onRunQuery: onRunQuery, showExplain: showExplain, "data-testid": testIds.editor }),
        query.expr !== '' && React.createElement(QueryPreview, { query: query.expr })));
}
const initialState = { expr: '' };
const stateSlice = createSlice({
    name: 'loki-builder-container',
    initialState,
    reducers: {
        visualQueryChange: (state, action) => {
            state.expr = action.payload.expr;
            state.visQuery = action.payload.visQuery;
        },
        exprChanged: (state, action) => {
            if (!state.visQuery || state.expr !== action.payload) {
                state.expr = action.payload;
                const parseResult = buildVisualQueryFromString(action.payload);
                state.visQuery = parseResult.query;
            }
        },
    },
});
const { visualQueryChange, exprChanged } = stateSlice.actions;
//# sourceMappingURL=LokiQueryBuilderContainer.js.map