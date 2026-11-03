import { createHash } from 'crypto';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1 } from '../../types';

import { buildDynamicThreshold, canonicalizeDynamicThresholdPolicy } from './buildDynamicThreshold';

const scalarOperators: Array<[EvalFunction, string]> = [
  [EvalFunction.IsAbove, '>'],
  [EvalFunction.IsBelow, '<'],
  [EvalFunction.IsEqual, '='],
  [EvalFunction.IsNotEqual, '<>'],
  [EvalFunction.IsGreaterThanEqual, '>='],
  [EvalFunction.IsLessThanEqual, '<='],
];
const rangeOperators: Array<[EvalFunction, string, string]> = [
  [EvalFunction.IsWithinRange, '> CASE', '< CASE'],
  [EvalFunction.IsOutsideRange, '< CASE', '> CASE'],
  [EvalFunction.IsWithinRangeIncluded, '>= CASE', '<= CASE'],
  [EvalFunction.IsOutsideRangeIncluded, '<= CASE', '>= CASE'],
];

function policy(overrides: Partial<DynamicThresholdPolicyV1> = {}): DynamicThresholdPolicyV1 {
  return {
    inputRefId: 'A',
    valueField: '__value__',
    matchLabel: 'environment',
    labelColumns: ['environment', 'region'],
    evaluator: EvalFunction.IsAbove,
    mappings: [{ labelValue: 'production', thresholds: [2] }],
    defaultThreshold: [5],
    ...overrides,
  };
}

describe('buildDynamicThreshold', () => {
  it.each(scalarOperators)('compiles scalar operator %s', (evaluator, operator) => {
    const result = buildDynamicThreshold(policy({ evaluator }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain(`A.__value__ ${operator} CASE A.environment`);
      expect(result.expressionSql).toContain("WHEN 'production' THEN 2");
      expect(result.expressionSql).toContain('ELSE 5');
    }
  });

  it.each(rangeOperators)('compiles range operator %s', (evaluator, lowerOperator, upperOperator) => {
    const result = buildDynamicThreshold(
      policy({ evaluator, mappings: [{ labelValue: 'production', thresholds: [2, 4] }], defaultThreshold: [5, 8] })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain(`A.__value__ ${lowerOperator} A.environment`);
      expect(result.expressionSql).toContain(`A.__value__ ${upperOperator} A.environment`);
      expect(result.previewSql).toContain('matched_threshold_lower');
      expect(result.previewSql).toContain('matched_threshold_upper');
    }
  });

  it('preserves label columns and returns one numeric alert result', () => {
    const result = buildDynamicThreshold(
      policy({ labelColumns: ['__metric_name__', '__display_name__', 'region'], matchLabel: 'region' })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.labelColumns).toEqual(['__metric_name__', '__display_name__', 'region']);
      expect(result.expressionSql).toContain('A.__metric_name__ AS __metric_name__');
      expect(result.expressionSql).toContain('A.__display_name__ AS __display_name__');
      expect(result.expressionSql.match(/alert_result/g)).toHaveLength(1);
    }
  });

  it('quotes identifiers, escapes label literals, and preserves case-sensitive mappings', () => {
    const result = buildDynamicThreshold(
      policy({
        inputRefId: 'input query',
        valueField: 'value field',
        matchLabel: 'match`label',
        labelColumns: ['match`label'],
        mappings: [
          { labelValue: "O'Reilly", thresholds: [1] },
          { labelValue: 'Production', thresholds: [2] },
          { labelValue: 'production', thresholds: [3] },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain('`input query`.`value field`');
      expect(result.expressionSql).toContain('`input query`.`match``label`');
      expect(result.expressionSql).toContain("WHEN 'O''Reilly' THEN 1");
      expect(result.expressionSql).toContain("WHEN 'Production' THEN 2");
      expect(result.expressionSql).toContain("WHEN 'production' THEN 3");
    }
  });

  it('preserves null numeric values and routes null or unmapped labels to the default', () => {
    const result = buildDynamicThreshold(policy());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain('WHEN A.__value__ IS NULL THEN NULL');
      expect(result.expressionSql).toContain('CASE A.environment');
      expect(result.expressionSql).toContain('ELSE 5');
    }
  });

  it('produces deterministic SQL and a canonical SHA-256 artifact hash', () => {
    const input = policy();
    const first = buildDynamicThreshold(input);
    const second = buildDynamicThreshold(structuredClone(input));

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (first.ok) {
      const expectedHash = createHash('sha256')
        .update(`${canonicalizeDynamicThresholdPolicy(input)}\n${first.expressionSql}`)
        .digest('hex');
      expect(canonicalizeDynamicThresholdPolicy(input)).toBe(
        '{"inputRefId":"A","valueField":"__value__","matchLabel":"environment","labelColumns":["environment","region"],"evaluator":"gt","mappings":[{"labelValue":"production","thresholds":[2]}],"defaultThreshold":[5]}'
      );
      expect(first.artifactHash).toBe(expectedHash);
      expect(first.artifactHash).toBe('def02c488b9494b3f2de1d30e734122a9c72f176111b3ffc8c5cc01cae112bb8');
    }
  });

  it.each([
    ['missing input', policy({ inputRefId: '' }), 'inputRefId'],
    ['missing value field', policy({ valueField: '' }), 'valueField'],
    ['missing match label', policy({ matchLabel: '' }), 'matchLabel'],
    ['match label absent from schema', policy({ matchLabel: 'zone' }), 'labelColumns'],
    ['value included as label', policy({ valueField: 'region' }), 'labelColumns'],
    ['duplicate label columns', policy({ labelColumns: ['environment', 'environment'] }), 'labelColumns'],
    [
      'duplicate mapping values',
      policy({
        mappings: [
          { labelValue: 'production', thresholds: [1] },
          { labelValue: 'production', thresholds: [2] },
        ],
      }),
      'duplicateMapping',
    ],
    ['invalid scalar arity', policy({ defaultThreshold: [1, 2] }), 'thresholdArity'],
    ['non-finite threshold', policy({ defaultThreshold: [Number.NaN] }), 'thresholdValue'],
    [
      'invalid range bounds',
      policy({ evaluator: EvalFunction.IsWithinRange, mappings: [], defaultThreshold: [2, 2] }),
      'range',
    ],
  ] as const)('rejects %s', (_name, input, errorCode) => {
    const result = buildDynamicThreshold(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: errorCode })]));
    }
  });
});
