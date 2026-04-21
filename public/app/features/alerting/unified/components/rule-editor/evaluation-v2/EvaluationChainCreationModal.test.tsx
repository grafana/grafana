import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RuleFormValues } from '../../../types/rule-form';

import { EvaluationChainCreationModal } from './EvaluationChainCreationModal';

function makeWrapper() {
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: { evaluateEvery: '1m' } as RuleFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe('EvaluationChainCreationModal', () => {
  it('renders name and interval fields', () => {
    render(<EvaluationChainCreationModal recordingRuleRefs={['rule-1']} onClose={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('textbox', { name: /evaluation chain name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
  });

  it('validates name is required', () => {
    render(<EvaluationChainCreationModal recordingRuleRefs={['rule-1']} onClose={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    // The Create button should be disabled when name is empty (form starts invalid due to required name)
    const createButton = screen.getByRole('button', { name: /create/i });
    expect(createButton).toBeDisabled();
  });

  it('enables create button when name is provided', async () => {
    const user = userEvent.setup();
    render(<EvaluationChainCreationModal recordingRuleRefs={['rule-1']} onClose={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    await user.type(screen.getByRole('textbox', { name: /evaluation chain name/i }), 'My Chain');

    expect(screen.getByRole('button', { name: /create/i })).toBeEnabled();
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<EvaluationChainCreationModal recordingRuleRefs={['rule-1']} onClose={onClose} />, {
      wrapper: makeWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders modal with correct title', () => {
    render(<EvaluationChainCreationModal recordingRuleRefs={['rule-1']} onClose={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/new evaluation chain/i)).toBeInTheDocument();
  });
});
