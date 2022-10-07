import { createAction, createReducer } from '@reduxjs/toolkit';

import { DataQuery, RelativeTimeRange, getDefaultRelativeTimeRange } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
} from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { queriesWithUpdatedReferences, refIdExists } from '../util';

export interface QueriesAndExpressionsState {
  queries: AlertQuery[];
}

const initialState: QueriesAndExpressionsState = {
  queries: [],
};

export const duplicateQuery = createAction<AlertQuery>('duplicateQuery');
export const addNewDataQuery = createAction('addNewDataQuery');
export const setDataQueries = createAction<AlertQuery[]>('setDataQueries');

export const addNewExpression = createAction('addNewExpression');
export const removeExpression = createAction<string>('removeExpression');
export const updateExpression = createAction<ExpressionQuery>('updateExpression');
export const updateExpressionRefId = createAction<{ oldRefId: string; newRefId: string }>('updateExpressionRefId');
export const rewireExpressions = createAction<{ oldRefId: string; newRefId: string }>('rewireExpressions');
export const updateExpressionType = createAction<{ refId: string; type: ExpressionQueryType }>('updateExpressionType');

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
    });

  // expressions actions
  builder
    .addCase(addNewExpression, (state) => {
      state.queries = addQuery(state.queries, {
        datasourceUid: ExpressionDatasourceUID,
        model: expressionDatasource.newQuery({
          type: ExpressionQueryType.math,
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
        return query.refId === payload.refId
          ? {
              ...query,
              model: payload,
            }
          : query;
      });
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
