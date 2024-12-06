import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormValues } from '../../types/rule-form';

import { ExpressionStatusIndicator } from './ExpressionStatusIndicator';

function FormWrapper({ isCondition }: { isCondition: boolean }) {
  const formApi = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues() } });

  return (
    <FormProvider {...formApi}>
      <ExpressionStatusIndicator isCondition={isCondition} />
    </FormProvider>
  );
}
describe('ExpressionStatusIndicator', () => {
  it('should render one element if condition', () => {
    render(<FormWrapper isCondition />);

    expect(screen.getByText('Alert condition')).toBeInTheDocument();
  });

  it('should render one element if not condition', () => {
    render(<FormWrapper isCondition={false} />);

    expect(screen.queryByRole('button', { name: 'Alert condition' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set as alert condition' })).toBeInTheDocument();
  });
});
