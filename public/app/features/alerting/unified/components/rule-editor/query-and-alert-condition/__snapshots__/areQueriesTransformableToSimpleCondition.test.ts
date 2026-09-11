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
import { type ExpressionQuery, ReducerMode } from 'app/features/expressions/types';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

const reduceExpression = mockReduceExpression({ expression: 'A', settings: { mode: ReducerMode.Strict } });
const thresholdExpression = mockThresholdExpression({ expression: 'B' });

const expressionQueries: Array<AlertQuery<ExpressionQuery>> = [reduceExpression, thresholdExpression];
const ds = mockDataSource({ type: DataSourceType.Prometheus, name: 'Mimir-cloud', uid: 'abc123' });
describe('areQueriesTransformableToSimpleCondition', () => {
  beforeEach(() => {
    setupDataSources(ds);
  });
  it('should return false if dataQueries length is not 1', async () => {
    // zero dataQueries
    expect(await areQueriesTransformableToSimpleCondition([], expressionQueries)).toBe(false);
    // more than one dataQueries
    expect(await areQueriesTransformableToSimpleCondition([mockDataQuery(), mockDataQuery()], expressionQueries)).toBe(
      false
    );
  });

  it('should return false if expressionQueries length is not 2', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, []);
    expect(result).toBe(false);
  });

  // notSimpleCondition
  // reducer:
  it('should return false if the mockDataQuery() refId does not match SimpleConditionIdentifier.queryId', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery({ refId: 'foo' })];
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
    expect(result).toBe(false);
  });

  it('should return false if no reduce expression is found with correct type and refId', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, [
      { ...reduceExpression, refId: 'hello' },
      thresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return false if no threshold expression is found that points to reducer', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, [
      reduceExpression,
      mockThresholdExpression({ expression: 'hello' }),
    ]);
    expect(result).toBe(false);
  });

  it('should return false if no threshold expression is found that points to instant data query', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery({ instant: true })];
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, [
      mockThresholdExpression({ expression: 'hello' }),
    ]);
    expect(result).toBe(false);
  });

  it('should return false if reduceExpression settings mode is not ReducerMode.Strict', async () => {
    const dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>> = [mockDataQuery()];
    const transformedReduceExpression = produce(reduceExpression, (draft) => {
      draft.model.settings = { mode: ReducerMode.DropNonNumbers };
    });

    const result = await areQueriesTransformableToSimpleCondition(dataQueries, [
      transformedReduceExpression,
      thresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return false if thresholdExpression unloadEvaluator has a value', async () => {
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
    const result = await areQueriesTransformableToSimpleCondition(dataQueries, [
      reduceExpression,
      transformedThresholdExpression,
    ]);
    expect(result).toBe(false);
  });

  it('should return true when data query is connected to valid reducer and threshold', async () => {
    const result = await areQueriesTransformableToSimpleCondition([mockDataQuery({ refId: 'A' })], expressionQueries);
    expect(result).toBe(true);
  });

  it('should return true when all conditions are met for instant data query with threshold', async () => {
    const result = await areQueriesTransformableToSimpleCondition(
      [mockDataQuery({ instant: true })],
      [mockThresholdExpression({ expression: 'A' })]
    );
    expect(result).toBe(true);
  });
});
