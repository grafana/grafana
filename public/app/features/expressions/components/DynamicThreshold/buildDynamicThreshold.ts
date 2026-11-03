import { t } from '@grafana/i18n';
import { quoteIdentifierIfNecessary } from '@grafana/sql';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1 } from '../../types';
import { SQL_EXPRESSIONS_DIALECT } from '../../utils/sqlIdentifier';

export type DynamicThresholdValidationErrorCode =
  | 'inputRefId'
  | 'valueField'
  | 'matchLabel'
  | 'labelColumns'
  | 'evaluator'
  | 'thresholdArity'
  | 'thresholdValue'
  | 'range'
  | 'duplicateMapping'
  | 'queryLength';

export interface DynamicThresholdValidationError {
  code: DynamicThresholdValidationErrorCode;
  message: string;
}

export type BuildDynamicThresholdResult =
  | {
      ok: true;
      expressionSql: string;
      previewSql: string;
      artifactHash: string;
      labelColumns: string[];
    }
  | { ok: false; errors: DynamicThresholdValidationError[] };

const RANGE_EVALUATORS = new Set([
  EvalFunction.IsWithinRange,
  EvalFunction.IsOutsideRange,
  EvalFunction.IsWithinRangeIncluded,
  EvalFunction.IsOutsideRangeIncluded,
]);
const SUPPORTED_EVALUATORS = new Set([
  EvalFunction.IsAbove,
  EvalFunction.IsBelow,
  EvalFunction.IsEqual,
  EvalFunction.IsNotEqual,
  EvalFunction.IsGreaterThanEqual,
  EvalFunction.IsLessThanEqual,
  ...RANGE_EVALUATORS,
]);
const CLIENT_QUERY_LENGTH_WARNING = 64_000;

export function isRangeEvaluator(evaluator: EvalFunction): boolean {
  return RANGE_EVALUATORS.has(evaluator);
}

export function canonicalizeDynamicThresholdPolicy(policy: DynamicThresholdPolicyV1): string {
  return JSON.stringify({
    inputRefId: policy.inputRefId,
    valueField: policy.valueField,
    matchLabel: policy.matchLabel,
    labelColumns: policy.labelColumns,
    evaluator: policy.evaluator,
    mappings: policy.mappings.map(({ labelValue, thresholds }) => ({ labelValue, thresholds })),
    defaultThreshold: policy.defaultThreshold,
  });
}

export function buildDynamicThreshold(policy: DynamicThresholdPolicyV1): BuildDynamicThresholdResult {
  const errors = validatePolicy(policy);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const table = quoteIdentifierIfNecessary(policy.inputRefId, SQL_EXPRESSIONS_DIALECT);
  const value = `${table}.${quoteIdentifierIfNecessary(policy.valueField, SQL_EXPRESSIONS_DIALECT)}`;
  const label = `${table}.${quoteIdentifierIfNecessary(policy.matchLabel, SQL_EXPRESSIONS_DIALECT)}`;
  const labels = policy.labelColumns.map(
    (column) =>
      `${table}.${quoteIdentifierIfNecessary(column, SQL_EXPRESSIONS_DIALECT)} AS ${quoteIdentifierIfNecessary(column, SQL_EXPRESSIONS_DIALECT)}`
  );
  const thresholdCases = policy.mappings
    .map((mapping) => `      WHEN ${quoteString(mapping.labelValue)} THEN ${formatNumber(mapping.thresholds[0])}`)
    .join('\n');
  const thresholdExpression = `CASE ${label}\n${thresholdCases}\n      ELSE ${formatNumber(policy.defaultThreshold[0])}\n    END`;
  const upperThresholdCases = isRangeEvaluator(policy.evaluator)
    ? policy.mappings
        .map((mapping) => `      WHEN ${quoteString(mapping.labelValue)} THEN ${formatNumber(mapping.thresholds[1])}`)
        .join('\n')
    : '';
  const upperThresholdExpression = isRangeEvaluator(policy.evaluator)
    ? `CASE ${label}\n${upperThresholdCases}\n      ELSE ${formatNumber(policy.defaultThreshold[1])}\n    END`
    : undefined;
  const condition = buildCondition(value, thresholdExpression, upperThresholdExpression, policy.evaluator);
  const selectedLabels = labels.length > 0 ? `${labels.join(',\n  ')},\n  ` : '';
  const expressionSql = `SELECT\n  ${selectedLabels}CASE\n    WHEN ${value} IS NULL THEN NULL\n    WHEN ${condition} THEN 1\n    ELSE 0\n  END AS alert_result\nFROM ${table}`;
  const previewThresholds = upperThresholdExpression
    ? `${thresholdExpression} AS matched_threshold_lower,\n  ${upperThresholdExpression} AS matched_threshold_upper,`
    : `${thresholdExpression} AS matched_threshold,`;
  const previewSql = `SELECT\n  ${selectedLabels}${value} AS current_value,\n  ${previewThresholds}\n  CASE\n    WHEN ${value} IS NULL THEN NULL\n    WHEN ${condition} THEN 1\n    ELSE 0\n  END AS condition_result\nFROM ${table}`;

  if (expressionSql.length > CLIENT_QUERY_LENGTH_WARNING) {
    return {
      ok: false,
      errors: [
        {
          code: 'queryLength',
          message: t('expressions.dynamic-threshold.error-query-length', 'Generated SQL is too long.'),
        },
      ],
    };
  }

  const artifactHash = sha256(`${canonicalizeDynamicThresholdPolicy(policy)}\n${expressionSql}`);
  return { ok: true, expressionSql, previewSql, artifactHash, labelColumns: [...policy.labelColumns] };
}

function validatePolicy(policy: DynamicThresholdPolicyV1): DynamicThresholdValidationError[] {
  const errors: DynamicThresholdValidationError[] = [];
  if (!policy.inputRefId.trim()) {
    errors.push({
      code: 'inputRefId',
      message: t('expressions.dynamic-threshold.error-input-query', 'Select an input query.'),
    });
  }
  if (!policy.valueField.trim()) {
    errors.push({
      code: 'valueField',
      message: t('expressions.dynamic-threshold.error-value-field', 'Select a numeric field.'),
    });
  }
  if (!policy.matchLabel.trim()) {
    errors.push({
      code: 'matchLabel',
      message: t('expressions.dynamic-threshold.error-match-label', 'Select a match label.'),
    });
  }
  if (!SUPPORTED_EVALUATORS.has(policy.evaluator)) {
    errors.push({
      code: 'evaluator',
      message: t('expressions.dynamic-threshold.error-operator', 'Select an operator.'),
    });
  }
  const labelSet = new Set(policy.labelColumns);
  if (policy.labelColumns.some((column) => !column.trim()) || labelSet.size !== policy.labelColumns.length) {
    errors.push({
      code: 'labelColumns',
      message: t(
        'expressions.dynamic-threshold.error-label-column-names',
        'Label column names must be unique and non-empty.'
      ),
    });
  }
  if (policy.matchLabel && !labelSet.has(policy.matchLabel)) {
    errors.push({
      code: 'labelColumns',
      message: t(
        'expressions.dynamic-threshold.error-match-label-schema',
        'The match label must be a known label column.'
      ),
    });
  }
  if (labelSet.has(policy.valueField)) {
    errors.push({
      code: 'labelColumns',
      message: t(
        'expressions.dynamic-threshold.error-value-field-label',
        'The numeric value field cannot be a label column.'
      ),
    });
  }
  const expectedArity = isRangeEvaluator(policy.evaluator) ? 2 : 1;
  validateThresholds(policy.defaultThreshold, expectedArity, 'default threshold', errors);
  const values = new Set<string>();
  for (const mapping of policy.mappings) {
    if (values.has(mapping.labelValue)) {
      errors.push({
        code: 'duplicateMapping',
        message: t('expressions.dynamic-threshold.error-duplicate-mapping', 'Duplicate mapping for {{labelValue}}.', {
          labelValue: mapping.labelValue,
        }),
      });
    }
    values.add(mapping.labelValue);
    validateThresholds(mapping.thresholds, expectedArity, `mapping ${mapping.labelValue}`, errors);
  }
  return errors;
}

function validateThresholds(
  thresholds: number[],
  expectedArity: number,
  name: string,
  errors: DynamicThresholdValidationError[]
) {
  if (thresholds.length !== expectedArity) {
    errors.push({
      code: 'thresholdArity',
      message: t(
        'expressions.dynamic-threshold.error-threshold-arity',
        '{{name}} requires {{expectedArity}} value(s).',
        { name, expectedArity }
      ),
    });
    return;
  }
  if (thresholds.some((threshold) => !Number.isFinite(threshold))) {
    errors.push({
      code: 'thresholdValue',
      message: t('expressions.dynamic-threshold.error-threshold-value', '{{name}} must contain finite numbers.', {
        name,
      }),
    });
  }
  if (expectedArity === 2 && thresholds[0] >= thresholds[1]) {
    errors.push({
      code: 'range',
      message: t(
        'expressions.dynamic-threshold.error-range',
        '{{name}} lower value must be less than its upper value.',
        { name }
      ),
    });
  }
}

function buildCondition(value: string, lower: string, upper: string | undefined, evaluator: EvalFunction): string {
  switch (evaluator) {
    case EvalFunction.IsAbove:
      return `${value} > ${lower}`;
    case EvalFunction.IsBelow:
      return `${value} < ${lower}`;
    case EvalFunction.IsEqual:
      return `${value} = ${lower}`;
    case EvalFunction.IsNotEqual:
      return `${value} <> ${lower}`;
    case EvalFunction.IsGreaterThanEqual:
      return `${value} >= ${lower}`;
    case EvalFunction.IsLessThanEqual:
      return `${value} <= ${lower}`;
    case EvalFunction.IsWithinRange:
      return `${value} > ${lower} AND ${value} < ${upper}`;
    case EvalFunction.IsOutsideRange:
      return `${value} < ${lower} OR ${value} > ${upper}`;
    case EvalFunction.IsWithinRangeIncluded:
      return `${value} >= ${lower} AND ${value} <= ${upper}`;
    case EvalFunction.IsOutsideRangeIncluded:
      return `${value} <= ${lower} OR ${value} >= ${upper}`;
    default:
      return 'FALSE';
  }
}

function quoteString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function formatNumber(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

// Small synchronous SHA-256 implementation keeps compilation atomic and browser-compatible.
function sha256(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    const p = nthPrime(i + 1);
    k[i] = Math.floor((Math.cbrt(p) % 1) * 0x100000000);
  }
  const w = new Uint32Array(64);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return Array.from(h, (value) => value.toString(16).padStart(8, '0')).join('');
}

function rotr(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function nthPrime(n: number): number {
  let found = 0;
  for (let value = 2; ; value++) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= value; divisor++) {
      if (value % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime && ++found === n) {
      return value;
    }
  }
}
