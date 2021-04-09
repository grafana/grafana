import React, { FC } from 'react';
import { Field, FieldSet, Input } from '@grafana/ui';
import { AlertRuleFormMethods } from './AlertRuleForm';

type Props = AlertRuleFormMethods;

const Expression: FC<Props> = ({ register }) => {
  return (
    <FieldSet label="Create a query (expression) to be alerted on">
      <Field>
        <Input ref={register()} name="expression" placeholder="Enter a PromQL query here" />
      </Field>
    </FieldSet>
  );
};

export default Expression;
