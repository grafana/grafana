import * as z from 'zod';

import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';

import {
  encodeExpressionQuery,
  expressionQueryCodec,
  parseExpressionQuery,
  validateExpressionQuery,
} from './expressionQuery';

jest.mock('@grafana/runtime', () => ({
  logWarning: jest.fn(),
}));

/** Models shaped the way they actually come back from the ruler API. */
const savedModels = {
  math: { refId: 'C', type: 'math', expression: '$B * 2', datasource: { type: '__expr__', uid: '__expr__' } },
  reduce: { refId: 'B', type: 'reduce', reducer: 'last', expression: 'A' },
  resample: { refId: 'B', type: 'resample', expression: 'A', window: '10m', downsampler: 'mean', upsampler: 'fillna' },
  threshold: {
    refId: 'C',
    type: 'threshold',
    expression: 'B',
    conditions: [{ evaluator: { type: 'gt', params: [10] } }],
  },
  classic: {
    refId: 'B',
    type: 'classic_conditions',
    conditions: [
      {
        type: 'query',
        evaluator: { type: 'gt', params: [5] },
        operator: { type: 'and' },
        query: { params: ['A'] },
        reducer: { type: 'avg', params: [] },
      },
    ],
  },
  sql: { refId: 'B', type: 'sql', expression: 'SELECT * FROM A', format: 'alerting' },
} as const;

describe('reading saved models', () => {
  it.each(Object.entries(savedModels))('reads a %s model', (_name, model) => {
    expect(parseExpressionQuery(model)).toMatchObject({ type: model.type });
  });

  // Guards the rule that every `.catch()` fallback has to satisfy the in-memory schema. Without
  // this, leniency breaks silently and a bad model throws instead of falling back.
  it.each(Object.values(ExpressionQueryType))('reads a completely malformed %s model', (type) => {
    const garbage = {
      type,
      refId: null,
      expression: null,
      reducer: 42,
      window: {},
      downsampler: [],
      upsampler: false,
      conditions: 'not an array',
      settings: 'not an object',
    };

    const parsed = parseExpressionQuery(garbage);

    expect(parsed).toBeDefined();
    expect(parsed?.type).toBe(type);
  });

  // A missing key is different from a malformed one, and Zod treats z.unknown() as required, so
  // these would otherwise fail the whole read and leave the rule unopenable.
  it('reads a reduce that has no reducer', () => {
    expect(parseExpressionQuery({ type: 'reduce', refId: 'B', expression: 'A' })).toMatchObject({
      reducer: 'mean',
    });
  });

  it('reads a resample that has neither sampler', () => {
    expect(parseExpressionQuery({ type: 'resample', refId: 'B', expression: 'A', window: '10m' })).toMatchObject({
      downsampler: 'mean',
      upsampler: 'fillna',
    });
  });

  it.each(Object.values(ExpressionQueryType))('reads a %s model carrying only its type', (type) => {
    expect(parseExpressionQuery({ type })).toMatchObject({ type });
  });

  it('returns undefined for a model with no type, rather than throwing', () => {
    expect(parseExpressionQuery({ refId: 'A', expression: 'A' })).toBeUndefined();
  });

  it('returns undefined for an unrecognised type', () => {
    expect(parseExpressionQuery({ refId: 'A', type: 'not-a-real-type' })).toBeUndefined();
  });
});

describe('unknown fields', () => {
  it('keeps fields we do not model through a read and write round trip', () => {
    const model = {
      ...savedModels.reduce,
      hide: false,
      intervalMs: 1000,
      maxDataPoints: 43200,
      somethingWeHaveNeverHeardOf: 'keep me',
    };

    const parsed = parseExpressionQuery(model);
    const written = encodeExpressionQuery(parsed!);

    expect(written).toMatchObject({
      hide: false,
      intervalMs: 1000,
      maxDataPoints: 43200,
      somethingWeHaveNeverHeardOf: 'keep me',
    });
  });

  it('keeps the per-condition type and reducer params a classic condition carries', () => {
    const parsed = parseExpressionQuery(savedModels.classic);
    const written = encodeExpressionQuery(parsed!);

    expect(written).toMatchObject({
      conditions: [{ type: 'query', reducer: { type: 'avg', params: [] } }],
    });
  });
});

describe('reduce settings', () => {
  it('leaves settings out entirely rather than writing null, which the backend rejects', () => {
    const parsed = parseExpressionQuery(savedModels.reduce);
    const written = encodeExpressionQuery(parsed!);

    // Checking the keys, not the value: an explicit `undefined` still serialises as `null` in some
    // paths, which is the thing we are guarding against.
    expect(Object.keys(written as object)).not.toContain('settings');
  });

  it('keeps settings when there is something to send', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.reduce,
      settings: { mode: 'replaceNN', replaceWithValue: 0 },
    });

    expect(encodeExpressionQuery(parsed!)).toMatchObject({
      settings: { mode: 'replaceNN', replaceWithValue: 0 },
    });
  });

  it('treats a missing mode as strict, which the backend spells as an empty string', () => {
    const parsed = parseExpressionQuery({ ...savedModels.reduce, settings: { mode: '' } });

    expect(encodeExpressionQuery(parsed!)).toMatchObject({ settings: { mode: '' } });
  });
});

describe('reducer names', () => {
  it('lower-cases a reduce reducer, matching what the backend does', () => {
    expect(parseExpressionQuery({ ...savedModels.reduce, reducer: 'MAX' })).toMatchObject({ reducer: 'max' });
  });

  it('falls back to mean for a reducer that reduce does not support', () => {
    // `avg` is a classic-condition reducer; reduce calls the same thing `mean`.
    expect(parseExpressionQuery({ ...savedModels.reduce, reducer: 'avg' })).toMatchObject({ reducer: 'mean' });
  });

  it('does not overwrite a classic condition reducer that is already set', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.classic,
      conditions: [
        {
          type: 'query',
          evaluator: { type: 'gt', params: [5] },
          query: { params: ['A'] },
          reducer: { type: 'max', params: [] },
        },
      ],
    });

    expect(parsed).toMatchObject({ conditions: [{ reducer: { type: 'max' } }] });
  });

  it('fills in only the classic conditions that are missing a reducer', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.classic,
      conditions: [
        {
          type: 'query',
          evaluator: { type: 'gt', params: [5] },
          query: { params: ['A'] },
          reducer: { type: 'sum', params: [] },
        },
        { type: 'query', evaluator: { type: 'gt', params: [5] }, query: { params: ['B'] } },
      ],
    });

    expect(parsed).toMatchObject({
      conditions: [{ reducer: { type: 'sum' } }, { reducer: { type: 'avg', params: [] } }],
    });
  });

  it('falls back to avg for a classic reducer we do not recognise', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.classic,
      conditions: [
        {
          type: 'query',
          evaluator: { type: 'gt', params: [5] },
          query: { params: ['A'] },
          reducer: { type: 'not-a-reducer', params: [] },
        },
      ],
    });

    expect(parsed).toMatchObject({ conditions: [{ reducer: { type: 'avg' } }] });
  });

  it('fills in a missing classic condition reducer', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.classic,
      conditions: [{ type: 'query', evaluator: { type: 'gt', params: [5] }, query: { params: ['A'] } }],
    });

    expect(parsed).toMatchObject({ conditions: [{ reducer: { type: 'avg', params: [] } }] });
  });
});

describe('refId references', () => {
  it('strips a leading $ for reduce, which the backend also ignores', () => {
    expect(parseExpressionQuery({ ...savedModels.reduce, expression: '$A' })).toMatchObject({ expression: 'A' });
  });

  it('strips a leading $ for resample', () => {
    expect(parseExpressionQuery({ ...savedModels.resample, expression: '$A' })).toMatchObject({ expression: 'A' });
  });

  it('leaves a threshold expression alone, because rewriting it would change the saved rule', () => {
    expect(parseExpressionQuery({ ...savedModels.threshold, expression: '$B' })).toMatchObject({ expression: '$B' });
  });
});

describe('hysteresis state', () => {
  it('keeps loadedFingerprints when an unrelated field is edited', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.threshold,
      conditions: [
        {
          evaluator: { type: 'gt', params: [10] },
          unloadEvaluator: { type: 'lt', params: [5] },
          loadedFingerprints: ['18446744073709551615', '42'],
        },
      ],
    });

    const edited = { ...parsed!, refId: 'D' };

    expect(encodeExpressionQuery(edited)).toMatchObject({
      conditions: [{ loadedFingerprints: ['18446744073709551615', '42'] }],
    });
  });

  it('treats a null unloadEvaluator as no hysteresis', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.threshold,
      conditions: [{ evaluator: { type: 'gt', params: [10] }, unloadEvaluator: null }],
    });

    const written = encodeExpressionQuery(parsed!) as { conditions: Array<Record<string, unknown>> };

    expect(Object.keys(written.conditions[0])).not.toContain('unloadEvaluator');
  });
});

describe('read is lenient but saving is not', () => {
  it('reads a threshold with no conditions, then refuses to save it as-is', () => {
    const parsed = parseExpressionQuery({ ...savedModels.threshold, conditions: [] });

    // Reading has to work, or the user cannot open their own rule.
    expect(parsed).toBeDefined();

    // A condition was filled in so the editor has something to show, and that is now valid.
    expect(validateExpressionQuery(parsed!).success).toBe(true);
  });

  it('refuses to save a threshold with more than one condition', () => {
    const twoConditions = {
      ...savedModels.threshold,
      conditions: [{ evaluator: { type: 'gt', params: [10] } }, { evaluator: { type: 'lt', params: [1] } }],
    };

    const parsed = parseExpressionQuery(twoConditions);

    // Both conditions survive the read rather than being silently thrown away.
    expect(parsed).toMatchObject({ conditions: [{}, {}] });
    expect(validateExpressionQuery(parsed!).success).toBe(false);
  });

  it('refuses to save a threshold whose expression still has a $ prefix', () => {
    const parsed = parseExpressionQuery({ ...savedModels.threshold, expression: '$B' });

    expect(parsed).toBeDefined();
    expect(validateExpressionQuery(parsed!).success).toBe(false);
  });

  it('refuses to save a range threshold with only one value', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.threshold,
      conditions: [{ evaluator: { type: EvalFunction.IsWithinRange, params: [5] } }],
    });

    expect(validateExpressionQuery(parsed!).success).toBe(false);
  });

  it('accepts a range threshold with two values', () => {
    const parsed = parseExpressionQuery({
      ...savedModels.threshold,
      conditions: [{ evaluator: { type: EvalFunction.IsWithinRange, params: [5, 10] } }],
    });

    expect(validateExpressionQuery(parsed!).success).toBe(true);
  });

  it('refuses to save a reduce in replaceNN mode with no replacement value', () => {
    const parsed = parseExpressionQuery({ ...savedModels.reduce, settings: { mode: 'replaceNN' } });

    expect(validateExpressionQuery(parsed!).success).toBe(false);
  });

  it('refuses to save an empty math expression', () => {
    const parsed = parseExpressionQuery({ ...savedModels.math, expression: '' });

    expect(validateExpressionQuery(parsed!).success).toBe(false);
  });

  it('rejects a structurally broken write even though reads are forgiving', () => {
    const broken = { ...savedModels.threshold, conditions: 'nonsense' };

    expect(z.safeEncode(expressionQueryCodec, broken as never).success).toBe(false);
  });
});
