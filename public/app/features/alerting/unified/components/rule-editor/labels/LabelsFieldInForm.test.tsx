import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { getDefaultFormValues } from '../../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';

import { LabelsFieldInForm } from './LabelsFieldInForm';

// The labels editor modal saves its result with setValue('labels', ...) on the rule form
function FormWrapper() {
  const formApi = useForm<RuleFormValues>({
    defaultValues: { ...getDefaultFormValues(), type: RuleFormType.grafana, labels: [] },
  });
  return (
    <FormProvider {...formApi}>
      <LabelsFieldInForm onEditClick={jest.fn()} />
      <button type="button" onClick={() => formApi.setValue('labels', [{ key: 'team', value: 'alerting' }])}>
        Save labels
      </button>
    </FormProvider>
  );
}

describe('LabelsFieldInForm', () => {
  it('shows labels saved to the form after it rendered', async () => {
    const { user } = render(<FormWrapper />);
    expect(screen.getByText('No labels selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save labels' }));

    expect(await screen.findByLabelText('team: alerting')).toBeInTheDocument();
    expect(screen.queryByText('No labels selected')).not.toBeInTheDocument();
  });
});
