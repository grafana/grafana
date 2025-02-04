import { useFormContext } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Field, Input, Stack, Text } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
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
    register,
    watch,
    formState: { errors },
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
        <Field label="Name" error={errors?.name?.message} invalid={!!errors.name?.message}>
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
            aria-label="name"
            placeholder={`Give your ${namePlaceholder} a name`}
          />
        </Field>
        {isGrafanaRecordingRule && (
          <Field label="Metric" error={errors?.metric?.message} invalid={!!errors.metric?.message}>
            <Input
              id="metric"
              width={38}
              {...register('metric', {
                required: { value: true, message: 'Must enter a metric name' },
                pattern: recordingRuleNameValidationPattern(RuleFormType.grafanaRecording),
              })}
              aria-label="metric"
              placeholder={`Give the name of the new recorded metric`}
            />
          </Field>
        )}
      </Stack>
    </RuleEditorSection>
  );
};
