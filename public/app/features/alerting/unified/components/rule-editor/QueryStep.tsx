import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, InputControl } from '@grafana/ui';
import { ExpressionEditor } from './ExpressionEditor';
import { RuleEditorSection } from './RuleEditorSection';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { AlertingQueryEditor } from '../../../components/AlertingQueryEditor';

export const QueryStep: FC = () => {
  const { control, watch, errors } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const dataSourceName = watch('dataSourceName');
  return (
    <RuleEditorSection stepNo={2} title="Create a query to be alerted on">
      {type === RuleFormType.system && dataSourceName && (
        <Field error={errors.expression?.message} invalid={!!errors.expression?.message}>
          <InputControl
            name="expression"
            dataSourceName={dataSourceName}
            as={ExpressionEditor}
            control={control}
            rules={{
              required: { value: true, message: 'A valid expression is required' },
            }}
          />
        </Field>
      )}
      {type === RuleFormType.threshold && (
        <Field
          invalid={!!errors.queries}
          error={(!!errors.queries && 'Must provide at least one valid query.') || undefined}
        >
          <InputControl
            name="queries"
            as={AlertingQueryEditor}
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
