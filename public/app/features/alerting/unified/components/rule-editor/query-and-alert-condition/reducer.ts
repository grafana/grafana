import { createAction, createReducer, original } from '@reduxjs/toolkit';

import {
  DataQuery,
  ReducerID,
  RelativeTimeRange,
  getDataSourceRef,
  getDefaultRelativeTimeRange,
  getNextRefId,
  rangeUtil,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { logError } from '../../../Analytics';
import { DataSourceType, getDefaultOrFirstCompatibleDataSource } from '../../../utils/datasource';
import { getDefaultQueries, getInstantFromDataQuery } from '../../../utils/rule-form';
import { createDagFromQueries, getOriginOfRefId } from '../dag';
import { queriesWithUpdatedReferences, refIdExists } from '../util';

import { SimpleConditionIdentifier } from './SimpleCondition';

export interface QueriesAndExpressionsState {
  queries: AlertQuery[];
}

const findDataSourceFromExpression = (queries: AlertQuery[], refId: string): AlertQuery | undefined => {
  const dag = createDagFromQueries(queries);
  const dataSource = getOriginOfRefId(refId, dag)[0];
  if (!dataSource) {
    return;
  }

  const originQuery = queries.find((query) => query.refId === dataSource);
  if (originQuery && 'relativeTimeRange' in originQuery) {
    return originQuery;
  }

  return;
};

const initialState: QueriesAndExpressionsState = {
  queries: [],
};

export const duplicateQuery = createAction<AlertQuery>('duplicateQuery');
export const addNewDataQuery = createAction('addNewDataQuery');
export const setDataQueries = createAction<AlertQuery[]>('setDataQueries');

export const addNewExpression = createAction<ExpressionQueryType>('addNewExpression');
export const removeExpression = createAction<string>('removeExpression');
export const removeExpressions = createAction('removeExpressions');
export const addExpressions = createAction<AlertQuery[]>('addExpressions');
export const updateExpression = createAction<ExpressionQuery>('updateExpression');
export const updateExpressionRefId = createAction<{ oldRefId: string; newRefId: string }>('updateExpressionRefId');
export const rewireExpressions = createAction<{ oldRefId: string; newRefId: string }>('rewireExpressions');
export const updateExpressionType = createAction<{ refId: string; type: ExpressionQueryType }>('updateExpressionType');
export const updateExpressionTimeRange = createAction('updateExpressionTimeRange');
export const updateMaxDataPoints = createAction<{ refId: string; maxDataPoints: number }>('updateMaxDataPoints');
export const updateMinInterval = createAction<{ refId: string; minInterval: string }>('updateMinInterval');

export const resetToSimpleCondition = createAction('resetToSimpleCondition');
export const optimizeReduceExpression = createAction<{ updatedQueries: AlertQuery[]; expressionQueries: AlertQuery[] }>(
  'optimizeReduceExpression'
);
export const setRecordingRulesQueries = createAction<{ recordingRuleQueries: AlertQuery[]; expression: string }>(
  'setRecordingRulesQueries'
);

export const queriesAndExpressionsReducer = createReducer(initialState, (builder) => {
  // data queries actions
  builder
    // simple condition actions
    .addCase(resetToSimpleCondition, (state) => {
      state.queries = getDefaultQueries();
    })
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
          datasource: getDataSourceRef(datasource),
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
        ...{ expr: payload.expression, model: query?.model },
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
    })
    .addCase(updateMinInterval, (state, action) => {
      state.queries = state.queries.map((query) => {
        return query.refId === action.payload.refId
          ? {
              ...query,
              model: {
                ...query.model,
                intervalMs: action.payload.minInterval ? rangeUtil.intervalToMs(action.payload.minInterval) : undefined,
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
    .addCase(removeExpressions, (state) => {
      state.queries = state.queries.filter((query) => !isExpressionQuery(query.model));
    })
    .addCase(addExpressions, (state, { payload }) => {
      state.queries = [...state.queries, ...payload];
    })
    .addCase(updateExpression, (state, { payload }) => {
      const queryToUpdate = state.queries.find((query) => query.refId === payload.refId);
      if (!queryToUpdate) {
        return;
      }

      queryToUpdate.model = payload;

      // the resample expression needs to also know what the relative time range is to work with, this means we have to copy it from the source node (data source query)
      if (payload.type === ExpressionQueryType.resample && payload.expression) {
        // findDataSourceFromExpression uses memoization and it doesn't always work with proxies when the proxy has been revoked
        const originalQueries = original(state)?.queries ?? [];

        let relativeTimeRange = getDefaultRelativeTimeRange();
        try {
          const dataSourceAlertQuery = findDataSourceFromExpression(originalQueries, payload.expression);
          if (dataSourceAlertQuery?.relativeTimeRange) {
            relativeTimeRange = dataSourceAlertQuery.relativeTimeRange;
          }
        } catch (error) {
          if (error instanceof Error) {
            logError(error);
          } else {
            logError(new Error('Error while trying to find data source from expression'));
          }
        }

        queryToUpdate.relativeTimeRange = relativeTimeRange;
      }
    })
    .addCase(updateExpressionTimeRange, (state) => {
      state.queries.forEach((query) => {
        // Resample expression needs to get the relativeTimeRange with its dataSource relativeTimeRange
        if (
          isExpressionQuery(query.model) &&
          query.model.type === ExpressionQueryType.resample &&
          query.model.expression
        ) {
          // findDataSourceFromExpression uses memoization and doesn't work with proxies
          const originalQueries = original(state)?.queries ?? [];

          const dataSource = findDataSourceFromExpression(originalQueries, query.model.expression);
          const relativeTimeRange = dataSource ? dataSource.relativeTimeRange : getDefaultRelativeTimeRange();
          query.relativeTimeRange = relativeTimeRange;
        }
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
    .addCase(optimizeReduceExpression, (state, { payload }) => {
      const { updatedQueries, expressionQueries } = payload;

      if (updatedQueries.length !== 1) {
        // we only optimize when we have one data query
        return;
      }

      //sometimes we dont have data source in the model yet
      const getDataSourceSettingsForFirstQuery = getDataSourceSrv().getInstanceSettings(
        updatedQueries[0].datasourceUid
      );

      if (!getDataSourceSettingsForFirstQuery) {
        return;
      }
      const type = getDataSourceSettingsForFirstQuery?.type;

      const firstQueryIsPromOrLoki = type === DataSourceType.Prometheus || type === DataSourceType.Loki;

      const isInstant = getInstantFromDataQuery(updatedQueries[0].model, type);

      const shouldRemoveReducer =
        firstQueryIsPromOrLoki && updatedQueries.length === 1 && isInstant && expressionQueries.length === 2;

      const onlyOneExpressionNotReducer =
        expressionQueries.length === 1 &&
        'type' in expressionQueries[0].model &&
        expressionQueries[0].model.type !== ExpressionQueryType.reduce;

      // we only add the reduce expression if we have one data query and one expression query. For other cases we don't do anything,
      // and let the user add the reducer manually.
      const shouldAddReduceExpression =
        firstQueryIsPromOrLoki && updatedQueries.length === 1 && !isInstant && onlyOneExpressionNotReducer;

      if (shouldRemoveReducer) {
        const reduceExpressionIndex = state.queries.findIndex(
          (query) => isExpressionQuery(query.model) && query.model.type === ExpressionQueryType.reduce
        );

        if (reduceExpressionIndex === 1) {
          // means the reduce expression is the second query
          state.queries.splice(reduceExpressionIndex, 1);
          state.queries[1].model.expression = SimpleConditionIdentifier.queryId;
        }
      }
      if (shouldAddReduceExpression) {
        // add reducer to the second position
        // we only update the refid and the model to point to the reducer expression
        state.queries[1].model.expression = SimpleConditionIdentifier.reducerId;
        // insert in second position the reducer expression
        state.queries.splice(1, 0, {
          datasourceUid: ExpressionDatasourceUID,
          model: expressionDatasource.newQuery({
            type: ExpressionQueryType.reduce,
            reducer: ReducerID.last,
            conditions: [{ ...defaultCondition, query: { params: [] } }],
            expression: SimpleConditionIdentifier.queryId,
            refId: SimpleConditionIdentifier.reducerId,
          }),
          refId: SimpleConditionIdentifier.reducerId,
          queryType: 'expression',
        });
      }
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
  const refId = getNextRefId(queries);
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
