import { produce } from 'immer';

import { EvalFunction } from 'app/features/alerting/state/alertDef';
import {
  mockDataQuery,
  mockDataSource,
  mockReduceExpression,
  mockThresholdExpression,
} from 'app/features/alerting/unified/mocks';
import { areQueriesTransformableToSimpleCondition } from 'app/features/alerting/unified/rule-editor/formProcessing';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { ExpressionQuery, ReducerMode } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

const reduceExpression = mockReduceExpression({ expression: 'A', settings: { mode: ReducerMode.Strict } });
const thresholdExpression = mockThresholdExpression({ expression: 'B' });

const expressionQueries: Array<AlertQuery<ExpressionQuery>> = [reduceExpression, thresholdExpression];
const ds = mockDataSource({ type: DataSourceType.Prometheus, name: 'Mimir-cloud', uid: 'abc123' });
describe('areQueriesTransformableToSimpleCondition', () => {
  beforeEach(() => {
    setupDataSources(ds);
  });
  it('should return false if dataQueries length is not 1', () => {
    // zero dataQueries
    expect(areQueriesTransformableToSimpleCondition([], expressionQueries)).toBe(false);
    // more than one dataQueries
    expect(areQueriesTransformableToSimpleCondition([mockDataQuery(), mockDataQuery()], expressionQueries)).toBe(false);
  });

  it('should return false if expressionQueries length is not 2', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = areQueriesTransformableToSimpleCondition(dataQueries, []);
    expect(result).toBe(false);
  });

  // notSimpleCondition
  // reducer:
  it('should return false if the mockDataQuery() refId does not match SimpleConditionIdentifier.queryId', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery({ refId: 'foo' })];
    const result = areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
    expect(result).toBe(false);
  });

  it('should return false if no reduce expression is found with correct type and refId', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = areQueriesTransformableToSimpleCondition(dataQueries, [
      { ...reduceExpression, refId: 'hello' },
      thresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return false if no threshold expression is found that points to reducer', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = areQueriesTransformableToSimpleCondition(dataQueries, [
      reduceExpression,
      mockThresholdExpression({ expression: 'hello' }),
    ]);
    expect(result).toBe(false);
  });

  it('should return false if no threshold expression is found that points to instant data query', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery({ instant: true })];
    const result = areQueriesTransformableToSimpleCondition(dataQueries, [
      mockThresholdExpression({ expression: 'hello' }),
    ]);
    expect(result).toBe(false);
  });

  it('should return false if reduceExpression settings mode is not ReducerMode.Strict', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const transformedReduceExpression = produce(reduceExpression, (draft) => {
      draft.model.settings = { mode: ReducerMode.DropNonNumbers };
    });

    const result = areQueriesTransformableToSimpleCondition(dataQueries, [
      transformedReduceExpression,
      thresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return false if thresholdExpression unloadEvaluator has a value', () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];

    const transformedThresholdExpression = produce(thresholdExpression, (draft) => {
      draft.model.conditions = [
        {
          evaluator: { params: [1], type: EvalFunction.IsAbove },
          unloadEvaluator: { params: [1], type: EvalFunction.IsAbove },
          query: { params: ['A'] },
          reducer: { params: [], type: 'avg' },
          type: 'query',
        },
      ];
    });
    const result = areQueriesTransformableToSimpleCondition(dataQueries, [
      reduceExpression,
      transformedThresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return true when data query is connected to valid reducer and threshold', () => {
    const result = areQueriesTransformableToSimpleCondition([mockDataQuery({ refId: 'A' })], expressionQueries);
    expect(result).toBe(true);
  });

  it('should return true when all conditions are met for instant data query with threshold', () => {
    const result = areQueriesTransformableToSimpleCondition(
      [mockDataQuery({ instant: true })],
      [mockThresholdExpression({ expression: 'A' })]
    );
    expect(result).toBe(true);
  });
});
