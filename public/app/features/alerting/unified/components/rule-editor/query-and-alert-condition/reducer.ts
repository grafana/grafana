import { createAction, createReducer } from '@reduxjs/toolkit';

import { DataQuery, getDefaultRelativeTimeRange, RelativeTimeRange } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { findDataSourceFromExpressionRecursive } from 'app/features/alerting/utils/dataSourceFromExpression';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { queriesWithUpdatedReferences, refIdExists } from '../util';

export interface QueriesAndExpressionsState {
  queries: AlertQuery[];
}

const findDataSourceFromExpression = (
  queries: AlertQuery[],
  expression: string | undefined
): AlertQuery | null | undefined => {
  const firstReference = queries.find((alertQuery) => alertQuery.refId === expression);
  const dataSource = firstReference && findDataSourceFromExpressionRecursive(queries, firstReference);
  return dataSource;
};

const initialState: QueriesAndExpressionsState = {
  queries: [],
};

export const duplicateQuery = createAction<AlertQuery>('duplicateQuery');
export const addNewDataQuery = createAction('addNewDataQuery');
export const setDataQueries = createAction<AlertQuery[]>('setDataQueries');

export const addNewExpression = createAction<ExpressionQueryType>('addNewExpression');
export const removeExpression = createAction<string>('removeExpression');
export const updateExpression = createAction<ExpressionQuery>('updateExpression');
export const updateExpressionRefId = createAction<{ oldRefId: string; newRefId: string }>('updateExpressionRefId');
export const rewireExpressions = createAction<{ oldRefId: string; newRefId: string }>('rewireExpressions');
export const updateExpressionType = createAction<{ refId: string; type: ExpressionQueryType }>('updateExpressionType');
export const updateExpressionTimeRange = createAction('updateExpressionTimeRange');
export const updateMaxDataPoints = createAction<{ refId: string; maxDataPoints: number }>('updateMaxDataPoints');

export const setRecordingRulesQueries = createAction<{ recordingRuleQueries: AlertQuery[]; expression: string }>(
  'setRecordingRulesQueries'
);

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
      const recordingRuleQuery = {
        ...query,
        ...{ expr: payload.expression, model: { expr: payload.expression, refId: query.model.refId } },
      };

      state.queries = [recordingRuleQuery];
    })
    .addCase(updateMaxDataPoints, (state, action) => {
      state.queries = state.queries.map((query) => {
        return query.refId === action.payload.refId
          ? {
              ...query,
              model: {
                ...query.model,
                maxDataPoints: action.payload.maxDataPoints,
              },
            }
          : query;
      });
    });

  // expressions actions
  builder
    .addCase(addNewExpression, (state, { payload }) => {
      state.queries = addQuery(state.queries, {
        datasourceUid: ExpressionDatasourceUID,
        model: expressionDatasource.newQuery({
          type: payload,
          conditions: [{ ...defaultCondition, query: { params: [] } }],
          expression: '',
        }),
      });
    })
    .addCase(removeExpression, (state, { payload }) => {
      state.queries = state.queries.filter((query) => query.refId !== payload);
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
          return {
            ...query,
            refId: newRefId,
            model: {
              ...query.model,
              refId: newRefId,
            },
          };
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
          ? {
              ...query,
              model: {
                ...expressionDatasource.newQuery({
                  type: action.payload.type,
                  conditions: [{ ...defaultCondition, query: { params: [] } }],
                  expression: '',
                }),
                refId: action.payload.refId,
              },
            }
          : query;
      });
    });
});

const addQuery = (
  queries: AlertQuery[],
  queryToAdd: Pick<AlertQuery, 'model' | 'datasourceUid' | 'relativeTimeRange'>
): AlertQuery[] => {
  const refId = getNextRefIdChar(queries);
  const query: AlertQuery = {
    ...queryToAdd,
    refId,
    queryType: '',
    model: {
      ...queryToAdd.model,
      hide: false,
      refId,
    },
    relativeTimeRange: queryToAdd.relativeTimeRange ?? defaultTimeRange(queryToAdd.model),
  };

  return [...queries, query];
};

const defaultTimeRange = (model: DataQuery): RelativeTimeRange | undefined => {
  if (isExpressionQuery(model)) {
    return;
  }

  return getDefaultRelativeTimeRange();
};
