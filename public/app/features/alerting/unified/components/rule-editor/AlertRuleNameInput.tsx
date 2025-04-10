import { Controller, useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Field, Input, Stack, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { isSupportedExternalPrometheusFlavoredRulesSourceType } from '../../utils/datasource';
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
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const ruleFormType = watch('type');
  if (!ruleFormType) {
    return null;
  }
  const isRecording = isRecordingRuleByType(ruleFormType);
  const isGrafanaRecordingRule = isGrafanaRecordingRuleByType(ruleFormType);
  const isCloudRecordingRule = isCloudRecordingRuleByType(ruleFormType);
  const recordingLabel = isGrafanaRecordingRule ? 'recording rule and metric' : 'recording rule';
  const namePlaceholder = isRecording ? 'recording rule' : 'alert rule';
  const entityName = isRecording ? recordingLabel : 'alert rule';
  return (
    <RuleEditorSection
      stepNo={1}
      title={`Enter ${entityName} name`}
      description={
        <Text variant="bodySmall" color="secondary">
          Enter a name to identify your {entityName}.
        </Text>
      }
    >
      <Stack direction="column">
        <Field
          label={t('alerting.alert-rule-name-and-metric.label-name', 'Name')}
          error={errors?.name?.message}
          invalid={!!errors.name?.message}
        >
          <Input
            data-testid={selectors.components.AlertRules.ruleNameField}
            id="name"
            width={38}
            {...register('name', {
              required: { value: true, message: 'Must enter a name' },
              pattern: isCloudRecordingRule
                ? recordingRuleNameValidationPattern(RuleFormType.cloudRecording)
                : undefined,
            })}
            aria-label={t('alerting.alert-rule-name-and-metric.aria-label-name', 'name')}
            placeholder={`Give your ${namePlaceholder} a name`}
          />
        </Field>
        {isGrafanaRecordingRule && (
          <Field
            label={t('alerting.alert-rule-name-and-metric.label-metric', 'Metric')}
            error={errors?.metric?.message}
            invalid={!!errors.metric?.message}
          >
            <Input
              id="metric"
              width={38}
              {...register('metric', {
                required: { value: true, message: 'Must enter a metric name' },
                pattern: recordingRuleNameValidationPattern(RuleFormType.grafanaRecording),
              })}
              aria-label={t('alerting.alert-rule-name-and-metric.metric-aria-label-metric', 'metric')}
              placeholder={`Give the name of the new recorded metric`}
            />
          </Field>
        )}

        {isGrafanaRecordingRule && config.featureToggles.grafanaManagedRecordingRulesDatasources && (
          <Field
            id="target-data-source"
            label={t('alerting.recording-rules.label-target-data-source', 'Target data source')}
            description={t(
              'alerting.recording-rules.description-target-data-source',
              'The Prometheus data source to store recording rules in'
            )}
            error={errors.targetDatasourceUid?.message}
            invalid={!!errors.targetDatasourceUid?.message}
          >
            <Controller
              render={({ field: { onChange, ref, ...field } }) => (
                <DataSourcePicker
                  {...field}
                  current={field.value}
                  noDefault
                  // Filter with `filter` prop instead of `type` prop to avoid showing the `-- Grafana --` data source
                  filter={(ds: DataSourceInstanceSettings) =>
                    isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type)
                  }
                  onChange={(ds: DataSourceInstanceSettings) => {
                    setValue('targetDatasourceUid', ds.uid);
                  }}
                />
              )}
              name="targetDatasourceUid"
              control={control}
              rules={{
                required: { value: true, message: 'Please select a data source' },
              }}
            />
          </Field>
        )}
      </Stack>
    </RuleEditorSection>
  );
};
