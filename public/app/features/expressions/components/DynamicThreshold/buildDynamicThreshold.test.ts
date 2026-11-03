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
      expect(result.expressionSql).toContain(`\`A\`.\`__value__\` ${operator} CASE \`A\`.\`environment\``);
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
      expect(result.expressionSql).toContain(`\`A\`.\`__value__\` ${lowerOperator} \`A\`.\`environment\``);
      expect(result.expressionSql).toContain(`\`A\`.\`__value__\` ${upperOperator} \`A\`.\`environment\``);
      expect(result.previewSql).toContain('`matched_threshold_lower`');
      expect(result.previewSql).toContain('`matched_threshold_upper`');
    }
  });

  it.each([
    [EvalFunction.IsAbove, [5], '`A`.`__value__` > 5', '5 AS `matched_threshold`'],
    [
      EvalFunction.IsWithinRange,
      [5, 8],
      '`A`.`__value__` > 5 AND `A`.`__value__` < 8',
      '5 AS `matched_threshold_lower`',
    ],
  ] as const)(
    'compiles a default-only %s policy without an empty CASE expression',
    (evaluator, defaults, condition, previewThreshold) => {
      const result = buildDynamicThreshold(policy({ evaluator, mappings: [], defaultThreshold: [...defaults] }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.expressionSql).toContain(condition);
        expect(result.expressionSql).not.toContain('CASE `A`.`environment`');
        expect(result.previewSql).toContain(previewThreshold);
      }
    }
  );

  it('preserves label columns and returns one numeric alert result', () => {
    const result = buildDynamicThreshold(
      policy({ labelColumns: ['__metric_name__', '__display_name__', 'region'], matchLabel: 'region' })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.labelColumns).toEqual(['__metric_name__', '__display_name__', 'region']);
      expect(result.expressionSql).toContain('`A`.`__metric_name__` AS `__metric_name__`');
      expect(result.expressionSql).toContain('`A`.`__display_name__` AS `__display_name__`');
      expect(result.expressionSql.match(/`alert_result`/g)).toHaveLength(1);
    }
  });

  it('always quotes identifiers and aliases, including reserved words', () => {
    const result = buildDynamicThreshold(
      policy({ inputRefId: 'order', valueField: 'select', matchLabel: 'group', labelColumns: ['group'] })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain('`order`.`select`');
      expect(result.expressionSql).toContain('`order`.`group` AS `group`');
      expect(result.expressionSql).toContain('END AS `alert_result`');
      expect(result.expressionSql).toContain('FROM `order`');
    }
  });

  it('escapes quotes and backslashes in adversarial label literals', () => {
    const result = buildDynamicThreshold(
      policy({
        mappings: [
          { labelValue: "O'Reilly", thresholds: [1] },
          { labelValue: 'ending\\', thresholds: [2] },
          { labelValue: "\\' OR 1=1 --", thresholds: [3] },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain("WHEN 'O''Reilly' THEN 1");
      expect(result.expressionSql).toContain("WHEN 'ending\\\\' THEN 2");
      expect(result.expressionSql).toContain("WHEN '\\\\'' OR 1=1 --' THEN 3");
    }
  });

  it('preserves null numeric values and routes null or unmapped labels to the default', () => {
    const result = buildDynamicThreshold(policy());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain('WHEN `A`.`__value__` IS NULL THEN NULL');
      expect(result.expressionSql).toContain('CASE `A`.`environment`');
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
      expect(first.artifactHash).toBe('6daa709c5dedb0d4f94c4cf8e2fe75f18d58bcb518df4f4040f869dc007e2ee5');
    }
  });

  it('canonicalizes U+2028, U+2029, and negative zero consistently with the backend hash contract', () => {
    const input = policy({
      mappings: [{ labelValue: 'line\u2028paragraph\u2029', thresholds: [-0] }],
      defaultThreshold: [-0],
    });
    const result = buildDynamicThreshold(input);

    expect(canonicalizeDynamicThresholdPolicy(input)).toContain('line\\u2028paragraph\\u2029');
    expect(canonicalizeDynamicThresholdPolicy(input)).toContain('"thresholds":[0]');
    expect(canonicalizeDynamicThresholdPolicy(input)).toContain('"defaultThreshold":[0]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.artifactHash).toBe('a3280102953c28db6ec06b59b473fbb41908bcc317f1eff273e2cc58490d5590');
    }
  });

  it.each([
    ['missing input', policy({ inputRefId: '' }), 'inputRefId', { field: 'inputRefId' }],
    ['missing value field', policy({ valueField: '' }), 'valueField', { field: 'valueField' }],
    ['missing match label', policy({ matchLabel: '' }), 'matchLabel', { field: 'matchLabel' }],
    ['match label absent from schema', policy({ matchLabel: 'zone' }), 'labelColumns', { field: 'matchLabel' }],
    ['value included as label', policy({ valueField: 'region' }), 'labelColumns', { field: 'valueField' }],
    [
      'duplicate label columns',
      policy({ labelColumns: ['environment', 'environment'] }),
      'labelColumns',
      { field: 'labelColumns' },
    ],
    [
      'duplicate mapping values',
      policy({
        mappings: [
          { labelValue: 'production', thresholds: [1] },
          { labelValue: 'production', thresholds: [2] },
        ],
      }),
      'duplicateMapping',
      { field: 'mappings', mappingIndex: 1 },
    ],
    ['invalid scalar arity', policy({ defaultThreshold: [1, 2] }), 'thresholdArity', { field: 'defaultThreshold' }],
    [
      'non-finite threshold',
      policy({ defaultThreshold: [Number.NaN] }),
      'thresholdValue',
      { field: 'defaultThreshold' },
    ],
    [
      'invalid range bounds',
      policy({ evaluator: EvalFunction.IsWithinRange, mappings: [], defaultThreshold: [2, 2] }),
      'range',
      { field: 'defaultThreshold' },
    ],
    [
      'lone high surrogate in mapping label',
      policy({ mappings: [{ labelValue: '\ud800', thresholds: [1] }] }),
      'invalidString',
      { field: 'mappings', mappingIndex: 0 },
    ],
    [
      'lone low surrogate in label column',
      policy({ matchLabel: '\udc00', labelColumns: ['\udc00'] }),
      'invalidString',
      { field: 'matchLabel' },
    ],
  ] as const)('rejects %s with a UI-addressable location', (_name, input, errorCode, location) => {
    const result = buildDynamicThreshold(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: errorCode, location })]));
    }
  });
});
