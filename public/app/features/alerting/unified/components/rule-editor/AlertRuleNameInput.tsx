import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useDataSourcesWithValidRecordingTargetByUid } from '@grafana/alerting/internal';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Field, Input, Stack, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { RuleFormType, type RuleFormValues } from '../../types/rule-form';
import { isCloudRecordingRuleByType, isGrafanaRecordingRuleByType, isRecordingRuleByType } from '../../utils/rules';

import { RuleEditorSection } from './RuleEditorSection';

const recordingRuleNameValidationPattern = (type: RuleFormType) => ({
  message: isGrafanaRecordingRuleByType(type)
    ? 'Recording rule metric must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.'
    : 'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
  value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
});

/**
 *  This component renders the input for the alert rule name.
 *  In case of recording rule, it also renders the input for the recording rule metric, and it validates this value.
 */
export const AlertRuleNameAndMetric = () => {
  const {
    control,
    register,
    watch,
    getValues,
    resetField,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const ruleFormType = watch('type');
  const isGrafanaRecordingRule = ruleFormType ? isGrafanaRecordingRuleByType(ruleFormType) : false;

  const recordingTargets = useDataSourcesWithValidRecordingTargetByUid();

  const defaultTargetUid = config.unifiedAlerting?.defaultRecordingRulesTargetDatasourceUID;
  useEffect(() => {
    if (!isGrafanaRecordingRule || !defaultTargetUid || getValues('targetDatasourceUid')) {
      return;
    }
    if (recordingTargets.byUid.has(defaultTargetUid)) {
      resetField('targetDatasourceUid', { defaultValue: defaultTargetUid });
    }
  }, [isGrafanaRecordingRule, defaultTargetUid, recordingTargets.byUid, getValues, resetField]);

  if (!ruleFormType) {
    return null;
  }
  const isRecording = isRecordingRuleByType(ruleFormType);
  const isCloudRecordingRule = isCloudRecordingRuleByType(ruleFormType);
  const recordingLabel = isGrafanaRecordingRule ? 'recording rule and metric' : 'recording rule';
  const namePlaceholder = isRecording ? 'recording rule' : 'alert rule';
  const entityName = isRecording ? recordingLabel : 'alert rule';
  return (
    <RuleEditorSection
      stepNo={1}
      title={t('alerting.alert-rule-name-and-metric.title-section', 'Enter {{entityName}} name', { entityName })}
      description={
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.alert-rule-name-and-metric.description-section">
            Enter a name to identify your {{ entityName }}.
          </Trans>
        </Text>
      }
    >
      <Stack direction="column" gap={2}>
        <Field
          label={t('alerting.alert-rule-name-and-metric.label-name', 'Name')}
          error={errors?.name?.message}
          invalid={!!errors.name?.message}
          noMargin
        >
          <Input
            data-testid={selectors.components.AlertRules.ruleNameField}
            id="name"
            width={38}
            {...register('name', {
              required: {
                value: true,
                message: t('alerting.alert-rule-name-and-metric.message.must-enter-a-name', 'Must enter a name'),
              },
              pattern: isCloudRecordingRule
                ? recordingRuleNameValidationPattern(RuleFormType.cloudRecording)
                : undefined,
            })}
            aria-label={t('alerting.alert-rule-name-and-metric.aria-label-name', 'name')}
            placeholder={t(
              'alerting.alert-rule-name-and-metric.placeholder-name',
              'Give your {{namePlaceholder}} a name',
              { namePlaceholder }
            )}
          />
        </Field>
        {isGrafanaRecordingRule && (
          <Field
            label={t('alerting.alert-rule-name-and-metric.label-metric', 'Metric')}
            error={errors?.metric?.message}
            invalid={!!errors.metric?.message}
            noMargin
          >
            <Input
              id="metric"
              width={38}
              {...register('metric', {
                required: {
                  value: true,
                  message: t(
                    'alerting.alert-rule-name-and-metric.message.must-enter-a-metric-name',
                    'Must enter a metric name'
                  ),
                },
                pattern: recordingRuleNameValidationPattern(RuleFormType.grafanaRecording),
              })}
              aria-label={t('alerting.alert-rule-name-and-metric.metric-aria-label-metric', 'metric')}
              placeholder={t(
                'alerting.alert-rule-name-and-metric.metric-placeholder-recorded-metric',
                'Give the name of the new recorded metric'
              )}
            />
          </Field>
        )}

        {isGrafanaRecordingRule && (
          <Field
            id="target-data-source"
            data-testid="target-data-source"
            label={t('alerting.recording-rules.label-target-data-source', 'Target data source')}
            description={t(
              'alerting.recording-rules.description-target-data-source',
              'The Prometheus data source to store recording rules in'
            )}
            error={
              errors.targetDatasourceUid?.message ??
              (recordingTargets.error &&
                t(
                  'alerting.recording-rules.target-data-sources-error',
                  'Failed to load the list of data sources that can store recording rules'
                ))
            }
            invalid={Boolean(errors.targetDatasourceUid?.message || recordingTargets.error)}
            noMargin
          >
            <Controller
              render={({ field: { onChange, ref, ...field } }) => (
                <DataSourcePicker
                  {...field}
                  current={field.value}
                  noDefault
                  disabled={recordingTargets.isLoading}
                  isLoading={recordingTargets.isLoading}
                  filter={(ds) => recordingTargets.byUid.has(ds.uid)}
                  onChange={(ds) => {
                    setValue('targetDatasourceUid', ds.uid);
                  }}
                />
              )}
              name="targetDatasourceUid"
              control={control}
              rules={{
                required: {
                  value: true,
                  message: t(
                    'alerting.alert-rule-name-and-metric.message.please-select-a-data-source',
                    'Please select a data source'
                  ),
                },
              }}
            />
          </Field>
        )}
      </Stack>
    </RuleEditorSection>
  );
};
