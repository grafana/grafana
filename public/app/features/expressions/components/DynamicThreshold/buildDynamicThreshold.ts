import { t } from '@grafana/i18n';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1 } from '../../types';

type DynamicThresholdValidationErrorCode =
  | 'inputRefId'
  | 'valueField'
  | 'matchLabel'
  | 'labelColumns'
  | 'evaluator'
  | 'thresholdArity'
  | 'thresholdValue'
  | 'range'
  | 'blankMapping'
  | 'duplicateMapping'
  | 'labelColumnCollision'
  | 'queryLength';

type DynamicThresholdValidationField = keyof DynamicThresholdPolicyV1;

export interface DynamicThresholdValidationError {
  code: DynamicThresholdValidationErrorCode;
  message: string;
  location: {
    field: DynamicThresholdValidationField;
    mappingIndex?: number;
  };
}

export type BuildDynamicThresholdResult =
  | {
      ok: true;
      expressionSql: string;
      previewSql: string;
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
const QUERY_LENGTH_LIMIT = 10_000;
const GENERATED_OUTPUT_COLUMNS = new Set([
  'alert_result',
  'current_value',
  'matched_threshold',
  'matched_threshold_lower',
  'matched_threshold_upper',
  'condition_result',
]);

export function isRangeEvaluator(evaluator: EvalFunction): boolean {
  return RANGE_EVALUATORS.has(evaluator);
}

export function buildDynamicThreshold(policy: DynamicThresholdPolicyV1): BuildDynamicThresholdResult {
  const errors = validatePolicy(policy);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const table = quoteIdentifier(policy.inputRefId);
  const value = `${table}.${quoteIdentifier(policy.valueField)}`;
  const label = `${table}.${quoteIdentifier(policy.matchLabel)}`;
  const labels = policy.labelColumns.map(
    (column) => `${table}.${quoteIdentifier(column)} AS ${quoteIdentifier(column)}`
  );
  const thresholdExpression = buildThresholdExpression(policy, label, 0);
  const upperThresholdExpression = isRangeEvaluator(policy.evaluator)
    ? buildThresholdExpression(policy, label, 1)
    : undefined;
  const condition = buildCondition(value, thresholdExpression, upperThresholdExpression, policy.evaluator);
  const selectedLabels = labels.length > 0 ? `${labels.join(',\n  ')},\n  ` : '';
  const expressionSql = `SELECT\n  ${selectedLabels}CASE\n    WHEN ${value} IS NULL THEN NULL\n    WHEN ${condition} THEN 1\n    ELSE 0\n  END AS ${quoteIdentifier('alert_result')}\nFROM ${table}`;
  const previewThresholds = upperThresholdExpression
    ? `${thresholdExpression} AS ${quoteIdentifier('matched_threshold_lower')},\n  ${upperThresholdExpression} AS ${quoteIdentifier('matched_threshold_upper')},`
    : `${thresholdExpression} AS ${quoteIdentifier('matched_threshold')},`;
  const previewSql = `SELECT\n  ${selectedLabels}${value} AS ${quoteIdentifier('current_value')},\n  ${previewThresholds}\n  CASE\n    WHEN ${value} IS NULL THEN NULL\n    WHEN ${condition} THEN 1\n    ELSE 0\n  END AS ${quoteIdentifier('condition_result')}\nFROM ${table}`;

  if (expressionSql.length > QUERY_LENGTH_LIMIT || previewSql.length > QUERY_LENGTH_LIMIT) {
    return {
      ok: false,
      errors: [
        {
          code: 'queryLength',
          message: t(
            'expressions.dynamic-threshold.error-query-length',
            'Generated SQL must not exceed {{limit}} characters.',
            { limit: QUERY_LENGTH_LIMIT }
          ),
          location: { field: 'mappings' },
        },
      ],
    };
  }

  return { ok: true, expressionSql, previewSql, labelColumns: [...policy.labelColumns] };
}

function buildThresholdExpression(policy: DynamicThresholdPolicyV1, label: string, thresholdIndex: number): string {
  const defaultValue = formatNumber(policy.defaultThreshold[thresholdIndex]);
  if (policy.mappings.length === 0) {
    return defaultValue;
  }

  const thresholdCases = policy.mappings
    .map(
      (mapping) =>
        `      WHEN ${quoteString(mapping.labelValue)} THEN ${formatNumber(mapping.thresholds[thresholdIndex])}`
    )
    .join('\n');
  return `CASE ${label}\n${thresholdCases}\n      ELSE ${defaultValue}\n    END`;
}

function validatePolicy(policy: DynamicThresholdPolicyV1): DynamicThresholdValidationError[] {
  const errors: DynamicThresholdValidationError[] = [];
  if (!policy.inputRefId.trim()) {
    errors.push({
      code: 'inputRefId',
      message: t('expressions.dynamic-threshold.error-input-query', 'Select an input query.'),
      location: { field: 'inputRefId' },
    });
  }
  if (!policy.valueField.trim()) {
    errors.push({
      code: 'valueField',
      message: t('expressions.dynamic-threshold.error-value-field', 'Select a numeric field.'),
      location: { field: 'valueField' },
    });
  }
  if (!policy.matchLabel.trim()) {
    errors.push({
      code: 'matchLabel',
      message: t('expressions.dynamic-threshold.error-match-label', 'Select a match label.'),
      location: { field: 'matchLabel' },
    });
  }
  if (!SUPPORTED_EVALUATORS.has(policy.evaluator)) {
    errors.push({
      code: 'evaluator',
      message: t('expressions.dynamic-threshold.error-operator', 'Select an operator.'),
      location: { field: 'evaluator' },
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
      location: { field: 'labelColumns' },
    });
  }
  const collidingColumn = policy.labelColumns.find((column) => GENERATED_OUTPUT_COLUMNS.has(column));
  if (collidingColumn) {
    errors.push({
      code: 'labelColumnCollision',
      message: t(
        'expressions.dynamic-threshold.error-label-column-collision',
        'Label column {{column}} conflicts with a generated output column.',
        { column: collidingColumn }
      ),
      location: { field: 'labelColumns' },
    });
  }
  if (policy.matchLabel && !labelSet.has(policy.matchLabel)) {
    errors.push({
      code: 'labelColumns',
      message: t(
        'expressions.dynamic-threshold.error-match-label-schema',
        'The match label must be a known label column.'
      ),
      location: { field: 'matchLabel' },
    });
  }
  if (labelSet.has(policy.valueField)) {
    errors.push({
      code: 'labelColumns',
      message: t(
        'expressions.dynamic-threshold.error-value-field-label',
        'The numeric value field cannot be a label column.'
      ),
      location: { field: 'valueField' },
    });
  }
  const expectedArity = isRangeEvaluator(policy.evaluator) ? 2 : 1;
  validateThresholds(policy.defaultThreshold, expectedArity, { field: 'defaultThreshold' }, errors);
  const values = new Set<string>();
  policy.mappings.forEach((mapping, mappingIndex) => {
    if (!mapping.labelValue.trim()) {
      errors.push({
        code: 'blankMapping',
        message: t('expressions.dynamic-threshold.error-blank-mapping', 'Mapping row {{row}} requires a label value.', {
          row: mappingIndex + 1,
        }),
        location: { field: 'mappings', mappingIndex },
      });
    } else if (values.has(mapping.labelValue)) {
      errors.push({
        code: 'duplicateMapping',
        message: t(
          'expressions.dynamic-threshold.error-duplicate-mapping',
          'Mapping row {{row}} duplicates another label value.',
          { row: mappingIndex + 1 }
        ),
        location: { field: 'mappings', mappingIndex },
      });
    }
    if (mapping.labelValue.trim()) {
      values.add(mapping.labelValue);
    }
    validateThresholds(mapping.thresholds, expectedArity, { field: 'mappings', mappingIndex }, errors);
  });
  return errors;
}

function validateThresholds(
  thresholds: Array<number | undefined>,
  expectedArity: number,
  location: DynamicThresholdValidationError['location'],
  errors: DynamicThresholdValidationError[]
) {
  const isMapping = location.mappingIndex !== undefined;
  const row = isMapping ? location.mappingIndex! + 1 : undefined;
  if (thresholds.length !== expectedArity) {
    errors.push({
      code: 'thresholdArity',
      message: isMapping
        ? t(
            'expressions.dynamic-threshold.error-mapping-threshold-arity',
            'Mapping row {{row}} requires {{expectedArity}} threshold value(s).',
            { row, expectedArity }
          )
        : t(
            'expressions.dynamic-threshold.error-default-threshold-arity',
            'The default threshold requires {{expectedArity}} value(s).',
            { expectedArity }
          ),
      location,
    });
    return;
  }
  if (
    Array.from({ length: expectedArity }, (_, index) => thresholds[index]).some(
      (threshold) => typeof threshold !== 'number' || !Number.isFinite(threshold)
    )
  ) {
    errors.push({
      code: 'thresholdValue',
      message: isMapping
        ? t(
            'expressions.dynamic-threshold.error-mapping-threshold-value',
            'Mapping row {{row}} must contain finite threshold values.',
            { row }
          )
        : t(
            'expressions.dynamic-threshold.error-default-threshold-value',
            'The default threshold must contain finite values.'
          ),
      location,
    });
  }
  if (
    expectedArity === 2 &&
    typeof thresholds[0] === 'number' &&
    typeof thresholds[1] === 'number' &&
    thresholds[0] >= thresholds[1]
  ) {
    errors.push({
      code: 'range',
      message: isMapping
        ? t(
            'expressions.dynamic-threshold.error-mapping-range',
            'Mapping row {{row}} must have a lower value that is less than its upper value.',
            { row }
          )
        : t(
            'expressions.dynamic-threshold.error-default-range',
            'The default threshold lower value must be less than its upper value.'
          ),
      location,
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

function quoteIdentifier(value: string): string {
  return `\`${value.replaceAll('`', '``')}\``;
}

function quoteString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function formatNumber(value: number | undefined): string {
  return String(value);
}
