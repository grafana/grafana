import { useEffect, useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, ConfirmModal, Field, Input, Select, Spinner, Stack } from '@grafana/ui';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1, type SqlExpressionQuery, thresholdFunctions } from '../../types';
import { SqlEditor } from '../SqlExpressions/SqlEditor/SqlEditor';

import { DynamicThresholdMappings } from './DynamicThresholdMappings';
import { DynamicThresholdPreview } from './DynamicThresholdPreview';
import { buildDynamicThreshold, isRangeEvaluator } from './buildDynamicThreshold';
import { getDynamicThresholdSourceOptions, useDynamicThresholdSourcePreview } from './sourcePreview';
import { withoutDynamicThreshold } from './utils';

interface Props {
  query: SqlExpressionQuery;
  queries: AlertQuery[];
  onChange: (query: SqlExpressionQuery) => void;
}

export function DynamicThresholdEditor({ query, queries, onChange }: Props) {
  const policy = query.dynamicThreshold!.policy;
  const [pendingMatchLabel, setPendingMatchLabel] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [confirmEditAsSql, setConfirmEditAsSql] = useState(false);
  const sourceOptions = useMemo(() => getDynamicThresholdSourceOptions(queries, query.refId), [queries, query.refId]);
  const source = useDynamicThresholdSourcePreview(queries, policy.inputRefId, policy.matchLabel);
  const result = buildDynamicThreshold(policy);
  const errors = result.ok ? [] : result.errors;
  const thresholdCount = isRangeEvaluator(policy.evaluator) ? 2 : 1;

  const updatePolicy = (nextPolicy: DynamicThresholdPolicyV1, useLiveSchema = true) => {
    const policyToBuild =
      useLiveSchema && nextPolicy.inputRefId === policy.inputRefId && source.hasSchema && source.stringFields.length > 0
        ? { ...nextPolicy, labelColumns: source.stringFields }
        : nextPolicy;
    const built = buildDynamicThreshold(policyToBuild);
    onChange({
      ...query,
      expression: built.ok ? built.expressionSql : '',
      format: 'alerting',
      dynamicThreshold: {
        version: 1,
        policy: {
          ...policyToBuild,
          labelColumns: built.ok ? built.labelColumns : policyToBuild.labelColumns,
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
      updatePolicy({ ...policy, valueField, labelColumns }, false);
    }
    // The schema result is the trigger; query updates feed the new policy back through props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.hasSchema, source.numericFields.join('\0'), source.stringFields.join('\0')]);

  const fieldError = (field: keyof DynamicThresholdPolicyV1) =>
    errors.find((error) => error.location.field === field && error.location.mappingIndex === undefined)?.message;
  const supportedFields = new Set<keyof DynamicThresholdPolicyV1>([
    'inputRefId',
    'valueField',
    'matchLabel',
    'evaluator',
    'defaultThreshold',
  ]);
  const generalErrors = errors.filter(
    (error) => error.location.mappingIndex === undefined && !supportedFields.has(error.location.field)
  );

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
          onChange={(option) => {
            const inputRefId = option?.value ?? '';
            if (inputRefId === policy.inputRefId) {
              return;
            }
            updatePolicy({
              ...policy,
              inputRefId,
              valueField: '',
              matchLabel: '',
              labelColumns: [],
              mappings: [],
              defaultThreshold: [],
            });
          }}
        />
      </Field>

      {generalErrors.length > 0 && (
        <Alert title={t('expressions.dynamic-threshold.validation-error', 'Unable to generate SQL')} severity="error">
          {generalErrors.map((error) => (
            <div key={`${error.code}-${error.message}`}>{error.message}</div>
          ))}
        </Alert>
      )}

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
        <>
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
        </>
      </Field>

      {result.ok && <DynamicThresholdPreview queries={queries} policy={policy} previewSql={result.previewSql} />}

      <Stack direction="row" gap={1}>
        <Button
          variant="secondary"
          size="sm"
          icon={showSql ? 'eye-slash' : 'eye'}
          disabled={!query.expression}
          onClick={() => setShowSql((current) => !current)}
        >
          {showSql
            ? t('expressions.dynamic-threshold.hide-sql', 'Hide SQL')
            : t('expressions.dynamic-threshold.view-sql', 'View SQL')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon="pen"
          disabled={!query.expression}
          onClick={() => setConfirmEditAsSql(true)}
        >
          {t('expressions.dynamic-threshold.edit-as-sql', 'Edit as SQL')}
        </Button>
      </Stack>
      {showSql && query.expression && (
        <SqlEditor
          value={query.expression}
          onChange={() => {}}
          readOnly
          height="200px"
          ariaLabel={t('expressions.dynamic-threshold.generated-sql', 'Generated SQL')}
        />
      )}

      <ConfirmModal
        isOpen={confirmEditAsSql}
        title={t('expressions.dynamic-threshold.edit-as-sql-title', 'Edit as SQL?')}
        body={t(
          'expressions.dynamic-threshold.edit-as-sql-body',
          'The generated SQL becomes a regular SQL expression. This conversion cannot be reversed automatically.'
        )}
        confirmText={t('expressions.dynamic-threshold.edit-as-sql-confirm', 'Edit as SQL')}
        onConfirm={() => {
          setConfirmEditAsSql(false);
          onChange(withoutDynamicThreshold(query));
        }}
        onDismiss={() => setConfirmEditAsSql(false)}
      />

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
