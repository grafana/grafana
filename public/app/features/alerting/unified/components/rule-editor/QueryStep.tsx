import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, InputControl } from '@grafana/ui';
import { ExpressionEditor } from './ExpressionEditor';
import { RuleEditorSection } from './RuleEditorSection';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { QueryEditor } from './QueryEditor';

export const QueryStep: FC = () => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  return (
    <RuleEditorSection
      stepNo={2}
      title={type === RuleFormType.cloudRecording ? 'Create a query to be recorded' : 'Create a query to be alerted on'}
    >
      {(type === RuleFormType.cloudRecording || type === RuleFormType.cloudAlerting) && dataSourceName && (
        <Field error={errors.expression?.message} invalid={!!errors.expression?.message}>
          <InputControl
            name="expression"
            render={({ field: { ref, ...field } }) => <ExpressionEditor {...field} dataSourceName={dataSourceName} />}
            control={control}
            rules={{
              required: { value: true, message: 'A valid expression is required' },
            }}
          />
        </Field>
      )}
      {type === RuleFormType.grafana && (
        <Field
          invalid={!!errors.queries}
          error={(!!errors.queries && 'Must provide at least one valid query.') || undefined}
        >
          <InputControl
            name="queries"
            render={({ field: { ref, ...field } }) => <QueryEditor {...field} />}
            control={control}
            rules={{
              validate: (queries) => Array.isArray(queries) && !!queries.length,
            }}
          />
        </Field>
      )}
    </RuleEditorSection>
  );
};
