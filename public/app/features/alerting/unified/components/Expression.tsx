import React, { FC } from 'react';
import { Field, FieldSet, Input, FormAPI } from '@grafana/ui';

type Props = FormAPI<any>;

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
