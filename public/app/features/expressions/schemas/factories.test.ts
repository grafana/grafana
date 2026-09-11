import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';

import {
  changeExpressionType,
  getExpressionInput,
  makeExpression,
  makeResampleExpression,
  makeThresholdExpression,
  withExpressionInput,
} from './factories';

describe('makeExpression', () => {
  it.each(Object.values(ExpressionQueryType))('builds a %s expression that is valid to save', (type) => {
    const query = makeExpression(type, { refId: 'B' });

    expect(query.type).toBe(type);
    expect(query.refId).toBe('B');
    // Defaults to the expression data source, which is how the backend knows to evaluate it
    // rather than sending it to a real data source.
    expect(query.datasource).toMatchObject({ uid: '__expr__' });
  });

  it('gives a reduce expression a reducer, because the backend rejects one without', () => {
    expect(makeExpression(ExpressionQueryType.reduce, { refId: 'B' })).toMatchObject({ reducer: 'mean' });
  });

  it('gives a resample expression both samplers', () => {
    expect(makeExpression(ExpressionQueryType.resample, { refId: 'B' })).toMatchObject({
      downsampler: 'mean',
      upsampler: 'fillna',
    });
  });

  it('gives a threshold expression exactly one condition, which is all the backend accepts', () => {
    const query = makeThresholdExpression({ refId: 'C' });

    expect(query).toMatchObject({
      conditions: [{ evaluator: { type: EvalFunction.IsAbove, params: [0] } }],
    });
  });

  it('gives a classic expression one condition to start from', () => {
    const query = makeExpression(ExpressionQueryType.classic, { refId: 'B' });

    expect(query).toMatchObject({ conditions: [{ type: 'query', reducer: { type: 'avg' } }] });
  });

  it('does not give a threshold expression the classic-only fields it used to carry', () => {
    const query = makeThresholdExpression({ refId: 'C' });

    // These were being written into every new rule and never read.
    expect(Object.keys(query.conditions[0])).not.toContain('query');
    expect(Object.keys(query.conditions[0])).not.toContain('reducer');
  });

  it('does not give a reduce expression a conditions array', () => {
    expect(Object.keys(makeExpression(ExpressionQueryType.reduce, { refId: 'B' }))).not.toContain('conditions');
  });

  it('builds two expressions of the same type identically', () => {
    expect(makeExpression(ExpressionQueryType.reduce, { refId: 'B' })).toEqual(
      makeExpression(ExpressionQueryType.reduce, { refId: 'B' })
    );
  });

  it('does not share condition objects between two expressions', () => {
    const first = makeThresholdExpression({ refId: 'C' });
    const second = makeThresholdExpression({ refId: 'D' });

    first.conditions[0].evaluator.params[0] = 99;

    expect(second.conditions[0].evaluator.params[0]).toBe(0);
  });
});

describe('getExpressionInput', () => {
  it('returns what the expression reads from', () => {
    expect(getExpressionInput(makeExpression(ExpressionQueryType.reduce, { refId: 'B' }, 'A'))).toBe('A');
  });

  it('returns undefined for a classic condition, which names its query per condition', () => {
    expect(getExpressionInput(makeExpression(ExpressionQueryType.classic, { refId: 'B' }))).toBeUndefined();
  });
});

describe('withExpressionInput', () => {
  it('repoints an expression at another query', () => {
    const query = makeExpression(ExpressionQueryType.threshold, { refId: 'C' }, 'A');

    expect(withExpressionInput(query, 'B')).toMatchObject({ expression: 'B' });
  });

  it('leaves a classic condition alone', () => {
    const query = makeExpression(ExpressionQueryType.classic, { refId: 'B' });

    expect(withExpressionInput(query, 'A')).toEqual(query);
  });
});

describe('changeExpressionType', () => {
  it('keeps the refId and carries the input across', () => {
    const reduce = makeExpression(ExpressionQueryType.reduce, { refId: 'B' }, 'A');
    const resampled = changeExpressionType(reduce, ExpressionQueryType.resample);

    expect(resampled).toMatchObject({ type: ExpressionQueryType.resample, refId: 'B', expression: 'A' });
  });

  it('drops fields that only made sense for the old type', () => {
    const resample = makeExpression(ExpressionQueryType.resample, { refId: 'B' }, 'A');
    const math = changeExpressionType(resample, ExpressionQueryType.math);

    expect(Object.keys(math)).not.toContain('window');
    expect(Object.keys(math)).not.toContain('downsampler');
  });

  it('leaves the expression alone when the type is not actually changing', () => {
    const resample = makeResampleExpression({ refId: 'B' }, { expression: 'A', window: '10s' });

    // Re-picking the same type in the editor should not wipe the window the user set.
    expect(changeExpressionType(resample, ExpressionQueryType.resample)).toEqual(resample);
  });

  it('gives the new type its own required fields', () => {
    const math = makeExpression(ExpressionQueryType.math, { refId: 'B' }, '$A > 1');
    const threshold = changeExpressionType(math, ExpressionQueryType.threshold);

    expect(threshold).toMatchObject({
      type: ExpressionQueryType.threshold,
      conditions: [{ evaluator: { type: EvalFunction.IsAbove } }],
    });
  });
});
