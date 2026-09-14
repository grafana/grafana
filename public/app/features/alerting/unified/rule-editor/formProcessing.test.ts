import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionDatasourceUID, ExpressionQueryType } from 'app/features/expressions/types';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { validateExpressionQueries } from './formProcessing';

function dataQuery(refId = 'A'): AlertQuery<AlertDataQuery> {
  return { refId, datasourceUid: 'prom-uid', queryType: '', model: { refId } };
}

function expression(refId: string, model: unknown): AlertQuery<AlertDataQuery> {
  return {
    refId,
    datasourceUid: ExpressionDatasourceUID,
    queryType: 'expression',
    model: model as AlertDataQuery,
  };
}

describe('validateExpressionQueries', () => {
  it('accepts a well-formed reduce and threshold pair', () => {
    const queries = [
      dataQuery(),
      expression('B', { refId: 'B', type: ExpressionQueryType.reduce, expression: 'A', reducer: 'last' }),
      expression('C', {
        refId: 'C',
        type: ExpressionQueryType.threshold,
        expression: 'B',
        conditions: [{ evaluator: { type: EvalFunction.IsAbove, params: [10] } }],
      }),
    ];

    expect(validateExpressionQueries(queries)).toBe(true);
  });

  it('ignores data queries', () => {
    expect(validateExpressionQueries([dataQuery(), dataQuery('B')])).toBe(true);
  });

  it('blocks a threshold that has no query to read', () => {
    const queries = [
      expression('C', {
        refId: 'C',
        type: ExpressionQueryType.threshold,
        expression: '',
        conditions: [{ evaluator: { type: EvalFunction.IsAbove, params: [10] } }],
      }),
    ];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  // The backend does not strip a leading $ for threshold the way it does for reduce and resample,
  // so a rule saved like this never fires.
  it('blocks a threshold whose query name still has a $ prefix', () => {
    const queries = [
      expression('C', {
        refId: 'C',
        type: ExpressionQueryType.threshold,
        expression: '$B',
        conditions: [{ evaluator: { type: EvalFunction.IsAbove, params: [10] } }],
      }),
    ];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  it('blocks a range threshold given only one value', () => {
    const queries = [
      expression('C', {
        refId: 'C',
        type: ExpressionQueryType.threshold,
        expression: 'B',
        conditions: [{ evaluator: { type: EvalFunction.IsWithinRange, params: [5] } }],
      }),
    ];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  it('blocks a reduce in replaceNN mode with no replacement value', () => {
    const queries = [
      expression('B', {
        refId: 'B',
        type: ExpressionQueryType.reduce,
        expression: 'A',
        reducer: 'last',
        settings: { mode: 'replaceNN' },
      }),
    ];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  it('blocks an empty math expression', () => {
    const queries = [expression('B', { refId: 'B', type: ExpressionQueryType.math, expression: '' })];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  it('blocks an empty SQL expression', () => {
    const queries = [expression('B', { refId: 'B', type: ExpressionQueryType.sql, expression: '  ' })];

    expect(validateExpressionQueries(queries)).toBe(false);
  });

  // An expression with no usable type is setQueryEditorSettings' problem, not this check's.
  it('leaves an unreadable expression to the editor-settings pass', () => {
    expect(validateExpressionQueries([expression('B', { refId: 'B' })])).toBe(true);
  });

  it('blocks when more than one expression is wrong', () => {
    const queries = [
      expression('B', { refId: 'B', type: ExpressionQueryType.math, expression: '' }),
      expression('C', { refId: 'C', type: ExpressionQueryType.sql, expression: '' }),
    ];

    expect(validateExpressionQueries(queries)).toBe(false);
  });
});
