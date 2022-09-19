import { render, screen } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm, UseFormProps } from 'react-hook-form';

import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';

import { RuleFormValues } from '../../types/rule-form';

import { ConditionField } from './ConditionField';

const FormProviderWrapper = ({ children, ...props }: React.PropsWithChildren<UseFormProps>) => {
  const methods = useForm({ ...props });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('ConditionField', () => {
  it('should render the correct condition when editing existing rule', () => {
    const existingRule = {
      name: 'ConditionsTest',
      condition: 'B',
      queries: [
        { refId: 'A' },
        { refId: 'B', datasourceUid: ExpressionDatasourceUID },
        { refId: 'C', datasourceUid: ExpressionDatasourceUID },
      ],
    } as RuleFormValues;

    const form = (
      <FormProviderWrapper defaultValues={existingRule}>
        <ConditionField existing={true} />
      </FormProviderWrapper>
    );

    render(form);
    expect(screen.getByLabelText(/^A/)).not.toBeChecked();
    expect(screen.getByLabelText(/^B/)).toBeChecked();
    expect(screen.getByLabelText(/^C/)).not.toBeChecked();
  });
});
