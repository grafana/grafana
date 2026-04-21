import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';

import { StandaloneEvaluation } from './StandaloneEvaluation';

function makeWrapper(defaultValues: Partial<RuleFormValues> = {}) {
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: {
        evaluateEvery: '1m',
        type: RuleFormType.grafana,
        ...defaultValues,
      } as RuleFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe('StandaloneEvaluation', () => {
  it('renders interval input with validation', () => {
    render(<StandaloneEvaluation />, { wrapper: makeWrapper() });

    expect(screen.getByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
  });

  it('renders quick-pick buttons', () => {
    render(<StandaloneEvaluation />, { wrapper: makeWrapper() });

    // EvaluationGroupQuickPick renders buttons for common intervals
    const buttons = screen.getAllByRole('option');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not show opt-in link when showOptInLink is false', () => {
    render(<StandaloneEvaluation showOptInLink={false} />, { wrapper: makeWrapper() });

    expect(screen.queryByRole('button', { name: /I want to add to an evaluation chain/i })).not.toBeInTheDocument();
  });

  it('does not show opt-in link when onOptIn is not provided', () => {
    render(<StandaloneEvaluation showOptInLink={true} />, { wrapper: makeWrapper() });

    // showOptInLink=true but no onOptIn callback — link should not render
    expect(screen.queryByRole('button', { name: /I want to add to an evaluation chain/i })).not.toBeInTheDocument();
  });

  it('shows opt-in link when showOptInLink is true and onOptIn is provided', () => {
    const onOptIn = jest.fn();
    render(<StandaloneEvaluation showOptInLink onOptIn={onOptIn} />, { wrapper: makeWrapper() });

    expect(screen.getByRole('button', { name: /I want to add to an evaluation chain/i })).toBeInTheDocument();
  });

  it('calls onOptIn when opt-in link is clicked', async () => {
    const user = userEvent.setup();
    const onOptIn = jest.fn();
    render(<StandaloneEvaluation showOptInLink onOptIn={onOptIn} />, { wrapper: makeWrapper() });

    await user.click(screen.getByRole('button', { name: /I want to add to an evaluation chain/i }));

    expect(onOptIn).toHaveBeenCalledTimes(1);
  });
});
