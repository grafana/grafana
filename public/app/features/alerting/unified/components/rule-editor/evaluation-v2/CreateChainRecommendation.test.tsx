import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';
import { EvaluationScenario } from '../../../types/evaluation-chain';
import { type RuleFormValues } from '../../../types/rule-form';

import { CreateChainRecommendation } from './CreateChainRecommendation';

const mockDetection: RecordingRuleDetectionResult = {
  scenario: EvaluationScenario.UnchainedRecordingRules,
  referencedRecordingRules: [
    { uid: 'rec-rule-1', name: 'CPU Recording Rule', metric: 'cpu_usage' },
    { uid: 'rec-rule-2', name: 'Memory Recording Rule', metric: 'memory_usage' },
  ],
  chains: [],
  warnings: [],
  isLoading: false,
};

function makeWrapper() {
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: { evaluateEvery: '1m' } as RuleFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe('CreateChainRecommendation', () => {
  it('renders info alert listing referenced recording rules', () => {
    render(<CreateChainRecommendation detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/recording rule dependency detected/i)).toBeInTheDocument();
    expect(screen.getByText(/CPU Recording Rule/)).toBeInTheDocument();
    expect(screen.getByText(/Memory Recording Rule/)).toBeInTheDocument();
  });

  it('opens creation modal when create button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateChainRecommendation detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /create evaluation chain/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/new evaluation chain/i)).toBeInTheDocument();
  });

  it('calls onOptOut when opt-out link is clicked', async () => {
    const user = userEvent.setup();
    const onOptOut = jest.fn();
    render(<CreateChainRecommendation detection={mockDetection} onOptOut={onOptOut} />, {
      wrapper: makeWrapper(),
    });

    await user.click(
      screen.getByRole('button', { name: /I don't want to use a chain, let me configure evaluation manually/i })
    );

    expect(onOptOut).toHaveBeenCalledTimes(1);
  });
});
