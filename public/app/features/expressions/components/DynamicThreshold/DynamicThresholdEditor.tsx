import { useEffect, useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, ConfirmModal, Field, Input, Select, Spinner, Stack } from '@grafana/ui';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1, type SqlExpressionQuery, thresholdFunctions } from '../../types';

import { DynamicThresholdMappings } from './DynamicThresholdMappings';
import { buildDynamicThreshold, isRangeEvaluator } from './buildDynamicThreshold';
import { getDynamicThresholdSourceOptions, useDynamicThresholdSourcePreview } from './sourcePreview';

interface Props {
  query: SqlExpressionQuery;
  queries: AlertQuery[];
  onChange: (query: SqlExpressionQuery) => void;
}

export function DynamicThresholdEditor({ query, queries, onChange }: Props) {
  const policy = query.dynamicThreshold!.policy;
  const [pendingMatchLabel, setPendingMatchLabel] = useState<string | null>(null);
  const sourceOptions = useMemo(() => getDynamicThresholdSourceOptions(queries, query.refId), [queries, query.refId]);
  const source = useDynamicThresholdSourcePreview(queries, policy.inputRefId, policy.matchLabel);
  const result = buildDynamicThreshold(policy);
  const errors = result.ok ? [] : result.errors;
  const thresholdCount = isRangeEvaluator(policy.evaluator) ? 2 : 1;

  const updatePolicy = (nextPolicy: DynamicThresholdPolicyV1) => {
    const built = buildDynamicThreshold(nextPolicy);
    onChange({
      ...query,
      expression: built.ok ? built.expressionSql : '',
      format: 'alerting',
      dynamicThreshold: {
        version: 1,
        policy: {
          ...nextPolicy,
          labelColumns: built.ok ? built.labelColumns : nextPolicy.labelColumns,
        },
      },
    });
  };

  useEffect(() => {
    if (!source.hasSchema) {
      return;
    }
    const valueField =
      !policy.valueField && source.numericFields.length === 1 ? source.numericFields[0] : policy.valueField;
    const labelColumns =
      policy.labelColumns.length === 0 && source.stringFields.length > 0 ? source.stringFields : policy.labelColumns;
    if (valueField !== policy.valueField || labelColumns !== policy.labelColumns) {
      updatePolicy({ ...policy, valueField, labelColumns });
    }
    // The schema result is the trigger; query updates feed the new policy back through props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.hasSchema, source.numericFields.join('\0'), source.stringFields.join('\0')]);

  const fieldError = (field: keyof DynamicThresholdPolicyV1) =>
    errors.find((error) => error.location.field === field && error.location.mappingIndex === undefined)?.message;

  const changeMatchLabel = (matchLabel: string) => {
    if (matchLabel === policy.matchLabel) {
      return;
    }
    if (policy.mappings.length > 0 || policy.defaultThreshold.length > 0) {
      setPendingMatchLabel(matchLabel);
    } else {
      updatePolicy({ ...policy, matchLabel });
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('expressions.dynamic-threshold.input-query', 'Input query')}
        invalid={fieldError('inputRefId') ? true : undefined}
        error={fieldError('inputRefId')}
      >
        <Select
          aria-label={t('expressions.dynamic-threshold.input-query', 'Input query')}
          options={sourceOptions}
          value={sourceOptions.find((option) => option.value === policy.inputRefId) ?? null}
          onChange={(option) =>
            updatePolicy({
              ...policy,
              inputRefId: option?.value ?? '',
              valueField: '',
              matchLabel: '',
              labelColumns: [],
              mappings: [],
              defaultThreshold: [],
            })
          }
        />
      </Field>

      {source.loading && (
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" />
          <Trans i18nKey="expressions.dynamic-threshold.schema-loading">Loading source schema</Trans>
        </Stack>
      )}
      {source.error && (
        <Alert title={t('expressions.dynamic-threshold.schema-error', 'Unable to load source schema')} severity="error">
          {source.error.message}
        </Alert>
      )}
      {policy.inputRefId &&
        source.hasSchema &&
        source.numericFields.length === 0 &&
        source.stringFields.length === 0 && (
          <Alert title={t('expressions.dynamic-threshold.schema-empty', 'No fields found')} severity="info">
            <Trans i18nKey="expressions.dynamic-threshold.schema-empty-body">
              The selected query returned no usable fields.
            </Trans>
          </Alert>
        )}

      <Field
        noMargin
        label={t('expressions.dynamic-threshold.numeric-field', 'Numeric field')}
        invalid={fieldError('valueField') ? true : undefined}
        error={fieldError('valueField')}
      >
        <Select
          aria-label={t('expressions.dynamic-threshold.numeric-field', 'Numeric field')}
          options={source.numericFields.map((field) => ({ value: field, label: field }))}
          value={policy.valueField ? { value: policy.valueField, label: policy.valueField } : null}
          onChange={(option) => updatePolicy({ ...policy, valueField: option?.value ?? '' })}
        />
      </Field>

      <Field
        noMargin
        label={t('expressions.dynamic-threshold.match-label', 'Match label')}
        invalid={fieldError('matchLabel') ? true : undefined}
        error={fieldError('matchLabel')}
      >
        <Select
          aria-label={t('expressions.dynamic-threshold.match-label', 'Match label')}
          options={source.stringFields.map((field) => ({ value: field, label: field }))}
          value={policy.matchLabel ? { value: policy.matchLabel, label: policy.matchLabel } : null}
          onChange={(option) => changeMatchLabel(option?.value ?? '')}
        />
      </Field>

      <Field
        noMargin
        label={t('expressions.dynamic-threshold.operator', 'Operator')}
        invalid={fieldError('evaluator') ? true : undefined}
        error={fieldError('evaluator')}
      >
        <Select
          aria-label={t('expressions.dynamic-threshold.operator', 'Operator')}
          options={thresholdFunctions}
          value={thresholdFunctions.find((option) => option.value === policy.evaluator)}
          onChange={(option) => {
            const evaluator = option?.value ?? EvalFunction.IsAbove;
            const count = isRangeEvaluator(evaluator) ? 2 : 1;
            updatePolicy({
              ...policy,
              evaluator,
              mappings: policy.mappings.map((mapping) => ({
                ...mapping,
                thresholds: resizeThresholds(mapping.thresholds, count),
              })),
              defaultThreshold: resizeThresholds(policy.defaultThreshold, count),
            });
          }}
        />
      </Field>

      <DynamicThresholdMappings
        mappings={policy.mappings}
        labelValues={source.labelValues}
        thresholdCount={thresholdCount}
        errors={errors}
        onChange={(mappings) => updatePolicy({ ...policy, mappings })}
      />

      <Field
        noMargin
        label={t('expressions.dynamic-threshold.default-threshold', 'Default threshold')}
        invalid={fieldError('defaultThreshold') ? true : undefined}
        error={fieldError('defaultThreshold')}
        required
      >
        <Stack direction="row" gap={1}>
          {Array.from({ length: thresholdCount }, (_, index) => (
            <Input
              key={index}
              type="number"
              aria-label={
                thresholdCount === 1
                  ? t('expressions.dynamic-threshold.default-threshold-input', 'Default threshold')
                  : index === 0
                    ? t('expressions.dynamic-threshold.default-lower-threshold-input', 'Default lower threshold')
                    : t('expressions.dynamic-threshold.default-upper-threshold-input', 'Default upper threshold')
              }
              value={policy.defaultThreshold[index] ?? ''}
              onChange={(event) => {
                const values = [...policy.defaultThreshold];
                if (event.currentTarget.value === '') {
                  values[index] = undefined;
                } else {
                  values[index] = Number(event.currentTarget.value);
                }
                updatePolicy({ ...policy, defaultThreshold: values });
              }}
            />
          ))}
        </Stack>
      </Field>

      <ConfirmModal
        isOpen={pendingMatchLabel !== null}
        title={t('expressions.dynamic-threshold.change-label-title', 'Change match label?')}
        body={t(
          'expressions.dynamic-threshold.change-label-body',
          'Changing the match label clears the existing mappings and default threshold.'
        )}
        confirmText={t('expressions.dynamic-threshold.change-label-confirm', 'Change label')}
        onConfirm={() => {
          updatePolicy({ ...policy, matchLabel: pendingMatchLabel ?? '', mappings: [], defaultThreshold: [] });
          setPendingMatchLabel(null);
        }}
        onDismiss={() => setPendingMatchLabel(null)}
      />
    </Stack>
  );
}

function resizeThresholds(thresholds: Array<number | undefined>, count: number): Array<number | undefined> {
  const resized = thresholds.slice(0, count);
  while (resized.length < count) {
    resized.push(undefined);
  }
  return resized;
}
