import React, { FC } from 'react';
import { Field, InputControl } from '@grafana/ui';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { ExpressionEditor } from './ExpressionEditor';
import { GrafanaQueryEditor } from './GrafanaQueryEditor';

// @TODO get proper query editors in
export const QueryStep: FC = () => {
  const { control, watch } = useFormContext<RuleFormValues>();
  const type = watch('type');
  const dataSourceName = watch('dataSourceName');
  return (
    <RuleEditorSection stepNo={2} title="Create a query to be alerted on">
      {type === RuleFormType.system && dataSourceName && (
        <Field>
          <InputControl name="expression" dataSourceName={dataSourceName} as={ExpressionEditor} control={control} />
        </Field>
      )}
      {type === RuleFormType.threshold && (
        <Field>
          <InputControl name="queries" as={GrafanaQueryEditor} control={control} />
        </Field>
      )}
    </RuleEditorSection>
  );
};
