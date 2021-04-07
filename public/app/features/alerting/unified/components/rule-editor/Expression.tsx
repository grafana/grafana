import React, { FC } from 'react';
import { Field, Input } from '@grafana/ui';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

const Expression: FC = () => {
  const { register } = useFormContext<RuleFormValues>();
  return (
    <RuleEditorSection stepNo={2} title="Create a query to be alerted on">
      <Field>
        <Input ref={register()} name="expression" placeholder="Enter a query here" />
      </Field>
    </RuleEditorSection>
  );
};

export default Expression;
