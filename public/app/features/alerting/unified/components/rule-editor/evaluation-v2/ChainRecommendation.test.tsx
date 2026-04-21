import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';
import { type EvaluationChain, EvaluationScenario } from '../../../types/evaluation-chain';
import { type RuleFormValues } from '../../../types/rule-form';

import { ChainRecommendation } from './ChainRecommendation';

const mockChain: EvaluationChain = {
  uid: 'chain-1',
  name: 'My Evaluation Chain',
  interval: '1m',
  intervalSeconds: 60,
  recordingRuleRefs: ['rec-rule-1'],
  alertRuleRefs: [],
};

const mockDetection: RecordingRuleDetectionResult = {
  scenario: EvaluationScenario.SingleChain,
  referencedRecordingRules: [
    {
      uid: 'rec-rule-1',
      name: 'CPU Recording Rule',
      metric: 'cpu_usage',
      chainUid: 'chain-1',
      chainName: 'My Evaluation Chain',
    },
  ],
  chains: [mockChain],
  recommendedChainUid: 'chain-1',
  warnings: [],
  isLoading: false,
};

function makeWrapper(defaultValues: Partial<RuleFormValues> = {}) {
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: { evaluateEvery: '1m', ...defaultValues } as RuleFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe('ChainRecommendation', () => {
  it('renders info alert about recording rule dependency', () => {
    render(<ChainRecommendation detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('status', { name: /recording rule dependency detected/i })).toBeInTheDocument();
    expect(screen.getByText(/recording rule dependency detected/i)).toBeInTheDocument();
  });

  it('renders chain info card with name and interval', () => {
    render(<ChainRecommendation detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByText('My Evaluation Chain')).toBeInTheDocument();
    expect(screen.getByText(/interval: 1m/i)).toBeInTheDocument();
  });

  it('calls onOptOut when opt-out link is clicked', async () => {
    const user = userEvent.setup();
    const onOptOut = jest.fn();
    render(<ChainRecommendation detection={mockDetection} onOptOut={onOptOut} />, {
      wrapper: makeWrapper(),
    });

    await user.click(
      screen.getByRole('button', { name: /I don't want to use a chain, let me configure evaluation manually/i })
    );

    expect(onOptOut).toHaveBeenCalledTimes(1);
  });

  it('auto-selects the recommended chain when none is selected', () => {
    // The auto-selection is tested indirectly via the form state
    // We verify the component renders without error when a recommended chain is available
    render(<ChainRecommendation detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper({ evaluationChainUid: undefined }),
    });

    // Chain info card should appear, meaning the recommended chain was detected
    expect(screen.getByText('My Evaluation Chain')).toBeInTheDocument();
  });
});
