import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1 } from '../../types';

import { buildDynamicThreshold } from './buildDynamicThreshold';

const scalarOperators: Array<[EvalFunction, string]> = [
  [EvalFunction.IsAbove, '>'],
  [EvalFunction.IsBelow, '<'],
  [EvalFunction.IsEqual, '='],
  [EvalFunction.IsNotEqual, '<>'],
  [EvalFunction.IsGreaterThanEqual, '>='],
  [EvalFunction.IsLessThanEqual, '<='],
];
const rangeOperators: Array<[EvalFunction, string, 'AND' | 'OR', string]> = [
  [EvalFunction.IsWithinRange, '>', 'AND', '<'],
  [EvalFunction.IsOutsideRange, '<', 'OR', '>'],
  [EvalFunction.IsWithinRangeIncluded, '>=', 'AND', '<='],
  [EvalFunction.IsOutsideRangeIncluded, '<=', 'OR', '>='],
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

  it.each(rangeOperators)(
    'compiles range operator %s with the correct thresholds and connector',
    (evaluator, lowerOperator, connector, upperOperator) => {
      const result = buildDynamicThreshold(
        policy({ evaluator, mappings: [{ labelValue: 'production', thresholds: [2, 4] }], defaultThreshold: [5, 8] })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.expressionSql).toContain(`\`A\`.\`__value__\` ${lowerOperator} CASE \`A\`.\`environment\`
      WHEN 'production' THEN 2
      ELSE 5
    END ${connector} \`A\`.\`__value__\` ${upperOperator} CASE \`A\`.\`environment\`
      WHEN 'production' THEN 4
      ELSE 8
    END`);
        expect(result.previewSql).toContain("WHEN 'production' THEN 2");
        expect(result.previewSql).toContain("WHEN 'production' THEN 4");
        expect(result.previewSql).toContain('`matched_threshold_lower`');
        expect(result.previewSql).toContain('`matched_threshold_upper`');
      }
    }
  );

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

  it('doubles backticks when quoting identifiers with backticks and spaces', () => {
    const result = buildDynamicThreshold(
      policy({
        inputRefId: 'input `query',
        valueField: 'value `field',
        matchLabel: 'match `label',
        labelColumns: ['match `label'],
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain('`input ``query`.`value ``field`');
      expect(result.expressionSql).toContain('`input ``query`.`match ``label` AS `match ``label`');
      expect(result.expressionSql).toContain('FROM `input ``query`');
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

  it('keeps mapping values that differ only by case distinct', () => {
    const result = buildDynamicThreshold(
      policy({
        mappings: [
          { labelValue: 'Production', thresholds: [2] },
          { labelValue: 'production', thresholds: [3] },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expressionSql).toContain("WHEN 'Production' THEN 2");
      expect(result.expressionSql).toContain("WHEN 'production' THEN 3");
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

  it('produces deterministic exact alert and preview SQL', () => {
    const input = policy();
    const first = buildDynamicThreshold(input);
    const second = buildDynamicThreshold(structuredClone(input));

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.expressionSql).toBe(`SELECT
  \`A\`.\`environment\` AS \`environment\`,
  \`A\`.\`region\` AS \`region\`,
  CASE
    WHEN \`A\`.\`__value__\` IS NULL THEN NULL
    WHEN \`A\`.\`__value__\` > CASE \`A\`.\`environment\`
      WHEN 'production' THEN 2
      ELSE 5
    END THEN 1
    ELSE 0
  END AS \`alert_result\`
FROM \`A\``);
      expect(first.previewSql).toBe(`SELECT
  \`A\`.\`environment\` AS \`environment\`,
  \`A\`.\`region\` AS \`region\`,
  \`A\`.\`__value__\` AS \`current_value\`,
  CASE \`A\`.\`environment\`
      WHEN 'production' THEN 2
      ELSE 5
    END AS \`matched_threshold\`,
  CASE
    WHEN \`A\`.\`__value__\` IS NULL THEN NULL
    WHEN \`A\`.\`__value__\` > CASE \`A\`.\`environment\`
      WHEN 'production' THEN 2
      ELSE 5
    END THEN 1
    ELSE 0
  END AS \`condition_result\`
FROM \`A\``);
    }
  });

  it.each([
    'alert_result',
    'current_value',
    'matched_threshold',
    'matched_threshold_lower',
    'matched_threshold_upper',
    'condition_result',
  ])('rejects label column collision with generated output %s', (generatedColumn) => {
    const result = buildDynamicThreshold(policy({ matchLabel: generatedColumn, labelColumns: [generatedColumn] }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'labelColumnCollision',
            location: { field: 'labelColumns' },
          }),
        ])
      );
    }
  });

  it.each([
    ['preview SQL', 35],
    ['alert expression SQL', 70],
  ])('rejects generated %s over the 10,000 character limit', (_sqlKind, mappingCount) => {
    const mappings = Array.from({ length: mappingCount }, (_, index) => ({
      labelValue: `${String(index).padStart(3, '0')}-${'x'.repeat(150)}`,
      thresholds: [index],
    }));
    const result = buildDynamicThreshold(policy({ mappings }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'queryLength', location: { field: 'mappings' } })])
      );
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
      'blank mapping value',
      policy({ mappings: [{ labelValue: '   ', thresholds: [1] }] }),
      'blankMapping',
      { field: 'mappings', mappingIndex: 0 },
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
      'unsupported evaluator',
      policy({ evaluator: 'unsupported' as EvalFunction }),
      'evaluator',
      { field: 'evaluator' },
    ],
    [
      'sparse default threshold',
      policy({
        evaluator: EvalFunction.IsWithinRange,
        mappings: [],
        defaultThreshold: [undefined, 2],
      }),
      'thresholdValue',
      { field: 'defaultThreshold' },
    ],
    [
      'undefined mapping threshold',
      policy({ mappings: [{ labelValue: 'production', thresholds: [undefined] }] }),
      'thresholdValue',
      { field: 'mappings', mappingIndex: 0 },
    ],
    [
      'non-number default threshold',
      policy({ defaultThreshold: ['5' as unknown as number] }),
      'thresholdValue',
      { field: 'defaultThreshold' },
    ],
    [
      'infinite default threshold',
      policy({ defaultThreshold: [Number.POSITIVE_INFINITY] }),
      'thresholdValue',
      { field: 'defaultThreshold' },
    ],
    [
      'mapping threshold arity',
      policy({ mappings: [{ labelValue: 'production', thresholds: [1, 2] }] }),
      'thresholdArity',
      { field: 'mappings', mappingIndex: 0 },
    ],
    [
      'infinite mapping threshold',
      policy({ mappings: [{ labelValue: 'production', thresholds: [Number.NEGATIVE_INFINITY] }] }),
      'thresholdValue',
      { field: 'mappings', mappingIndex: 0 },
    ],
    [
      'mapping range bounds',
      policy({
        evaluator: EvalFunction.IsWithinRange,
        mappings: [{ labelValue: 'production', thresholds: [3, 3] }],
        defaultThreshold: [1, 2],
      }),
      'range',
      { field: 'mappings', mappingIndex: 0 },
    ],
    [
      'invalid range bounds',
      policy({ evaluator: EvalFunction.IsWithinRange, mappings: [], defaultThreshold: [2, 2] }),
      'range',
      { field: 'defaultThreshold' },
    ],
  ] as const)('rejects %s with a UI-addressable location', (_name, input, errorCode, location) => {
    const result = buildDynamicThreshold(input);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('undefined');
    if (!result.ok) {
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: errorCode, location })]));
    }
  });
});
