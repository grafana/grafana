import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Field, Input, Text } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import { RuleEditorSection } from './RuleEditorSection';

const recordingRuleNameValidationPattern = {
  message:
    'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
  value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
};

export const AlertRuleNameInput = () => {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const ruleFormType = watch('type');
  const entityName = ruleFormType === RuleFormType.cloudRecording ? 'recording rule' : 'alert rule';

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
      <Field label="Name" error={errors?.name?.message} invalid={!!errors.name?.message}>
        <Input
          id="name"
          width={35}
          {...register('name', {
            required: { value: true, message: 'Must enter a name' },
            pattern: ruleFormType === RuleFormType.cloudRecording ? recordingRuleNameValidationPattern : undefined,
          })}
          aria-label="name"
          placeholder={`Give your ${entityName} a name`}
        />
      </Field>
    </RuleEditorSection>
  );
};
