import { render, screen } from '@testing-library/react';
import React, { FC } from 'react';
import { FormProvider, useForm, UseFormProps } from 'react-hook-form';

import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';

import { RuleFormValues } from '../../types/rule-form';

import { ConditionField } from './ConditionField';

const FormProviderWrapper: FC<UseFormProps> = ({ children, ...props }) => {
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
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
