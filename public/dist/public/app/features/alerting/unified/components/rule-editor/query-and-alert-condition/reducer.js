import { createAction, createReducer } from '@reduxjs/toolkit';
import { getDefaultRelativeTimeRange, rangeUtil } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { findDataSourceFromExpressionRecursive } from 'app/features/alerting/utils/dataSourceFromExpression';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionDatasourceUID, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { queriesWithUpdatedReferences, refIdExists } from '../util';
const findDataSourceFromExpression = (queries, expression) => {
    const firstReference = queries.find((alertQuery) => alertQuery.refId === expression);
    const dataSource = firstReference && findDataSourceFromExpressionRecursive(queries, firstReference);
    return dataSource;
};
const initialState = {
    queries: [],
};
export const duplicateQuery = createAction('duplicateQuery');
export const addNewDataQuery = createAction('addNewDataQuery');
export const setDataQueries = createAction('setDataQueries');
export const addNewExpression = createAction('addNewExpression');
export const removeExpression = createAction('removeExpression');
export const removeExpressions = createAction('removeExpressions');
export const addExpressions = createAction('addExpressions');
export const updateExpression = createAction('updateExpression');
export const updateExpressionRefId = createAction('updateExpressionRefId');
export const rewireExpressions = createAction('rewireExpressions');
export const updateExpressionType = createAction('updateExpressionType');
export const updateExpressionTimeRange = createAction('updateExpressionTimeRange');
export const updateMaxDataPoints = createAction('updateMaxDataPoints');
export const updateMinInterval = createAction('updateMinInterval');
export const setRecordingRulesQueries = createAction('setRecordingRulesQueries');
export const queriesAndExpressionsReducer = createReducer(initialState, (builder) => {
    // data queries actions
    builder
        .addCase(duplicateQuery, (state, { payload }) => {
        state.queries = addQuery(state.queries, payload);
    })
        .addCase(addNewDataQuery, (state) => {
        const datasource = getDefaultOrFirstCompatibleDataSource();
        if (!datasource) {
            return;
        }
        state.queries = addQuery(state.queries, {
            datasourceUid: datasource.uid,
            model: {
                refId: '',
                datasource: {
                    type: datasource.type,
                    uid: datasource.uid,
                },
            },
        });
    })
        .addCase(setDataQueries, (state, { payload }) => {
        const expressionQueries = state.queries.filter((query) => isExpressionQuery(query.model));
        state.queries = [...payload, ...expressionQueries];
    })
        .addCase(setRecordingRulesQueries, (state, { payload }) => {
        const query = payload.recordingRuleQueries[0];
        const recordingRuleQuery = Object.assign(Object.assign({}, query), { expr: payload.expression, model: query === null || query === void 0 ? void 0 : query.model });
        state.queries = [recordingRuleQuery];
    })
        .addCase(updateMaxDataPoints, (state, action) => {
        state.queries = state.queries.map((query) => {
            return query.refId === action.payload.refId
                ? Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, query.model), { maxDataPoints: action.payload.maxDataPoints }) }) : query;
        });
    })
        .addCase(updateMinInterval, (state, action) => {
        state.queries = state.queries.map((query) => {
            return query.refId === action.payload.refId
                ? Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, query.model), { intervalMs: action.payload.minInterval ? rangeUtil.intervalToMs(action.payload.minInterval) : undefined }) }) : query;
        });
    });
    // expressions actions
    builder
        .addCase(addNewExpression, (state, { payload }) => {
        state.queries = addQuery(state.queries, {
            datasourceUid: ExpressionDatasourceUID,
            model: expressionDatasource.newQuery({
                type: payload,
                conditions: [Object.assign(Object.assign({}, defaultCondition), { query: { params: [] } })],
                expression: '',
            }),
        });
    })
        .addCase(removeExpression, (state, { payload }) => {
        state.queries = state.queries.filter((query) => query.refId !== payload);
    })
        .addCase(removeExpressions, (state) => {
        state.queries = state.queries.filter((query) => !isExpressionQuery(query.model));
    })
        .addCase(addExpressions, (state, { payload }) => {
        state.queries = [...state.queries, ...payload];
    })
        .addCase(updateExpression, (state, { payload }) => {
        state.queries = state.queries.map((query) => {
            const dataSourceAlertQuery = findDataSourceFromExpression(state.queries, payload.expression);
            const relativeTimeRange = dataSourceAlertQuery
                ? dataSourceAlertQuery.relativeTimeRange
                : getDefaultRelativeTimeRange();
            if (query.refId === payload.refId) {
                query.model = payload;
                if (payload.type === ExpressionQueryType.resample) {
                    query.relativeTimeRange = relativeTimeRange;
                }
            }
            return query;
        });
    })
        .addCase(updateExpressionTimeRange, (state) => {
        const newState = state.queries.map((query) => {
            // It's an expression , let's update the relativeTimeRange with its dataSource relativeTimeRange
            if (query.datasourceUid === ExpressionDatasourceUID) {
                const dataSource = findDataSourceFromExpression(state.queries, query.model.expression);
                const relativeTimeRange = dataSource ? dataSource.relativeTimeRange : getDefaultRelativeTimeRange();
                query.relativeTimeRange = relativeTimeRange;
            }
            return query;
        });
        state.queries = newState;
    })
        .addCase(updateExpressionRefId, (state, { payload }) => {
        const { newRefId, oldRefId } = payload;
        // if the new refId already exists we just refuse to update the state
        const newRefIdExists = refIdExists(state.queries, newRefId);
        if (newRefIdExists) {
            return;
        }
        const updatedQueries = queriesWithUpdatedReferences(state.queries, oldRefId, newRefId);
        state.queries = updatedQueries.map((query) => {
            if (query.refId === oldRefId) {
                return Object.assign(Object.assign({}, query), { refId: newRefId, model: Object.assign(Object.assign({}, query.model), { refId: newRefId }) });
            }
            return query;
        });
    })
        .addCase(rewireExpressions, (state, { payload }) => {
        state.queries = queriesWithUpdatedReferences(state.queries, payload.oldRefId, payload.newRefId);
    })
        .addCase(updateExpressionType, (state, action) => {
        state.queries = state.queries.map((query) => {
            return query.refId === action.payload.refId
                ? Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, expressionDatasource.newQuery({
                        type: action.payload.type,
                        conditions: [Object.assign(Object.assign({}, defaultCondition), { query: { params: [] } })],
                        expression: '',
                    })), { refId: action.payload.refId }) }) : query;
        });
    });
});
const addQuery = (queries, queryToAdd) => {
    var _a;
    const refId = getNextRefIdChar(queries);
    const query = Object.assign(Object.assign({}, queryToAdd), { refId, queryType: '', model: Object.assign(Object.assign({}, queryToAdd.model), { hide: false, refId }), relativeTimeRange: (_a = queryToAdd.relativeTimeRange) !== null && _a !== void 0 ? _a : defaultTimeRange(queryToAdd.model) });
    return [...queries, query];
};
const defaultTimeRange = (model) => {
    if (isExpressionQuery(model)) {
        return;
    }
    return getDefaultRelativeTimeRange();
};
//# sourceMappingURL=reducer.js.map