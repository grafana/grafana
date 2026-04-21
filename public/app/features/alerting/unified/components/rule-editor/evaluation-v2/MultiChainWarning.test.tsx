import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';
import { EvaluationScenario } from '../../../types/evaluation-chain';
import { type RuleFormValues } from '../../../types/rule-form';

import { MultiChainWarning } from './MultiChainWarning';

const mockDetection: RecordingRuleDetectionResult = {
  scenario: EvaluationScenario.MultipleChains,
  referencedRecordingRules: [
    { uid: 'rec-1', name: 'Rule 1', metric: 'cpu_usage', chainUid: 'chain-a', chainName: 'Chain A' },
    { uid: 'rec-2', name: 'Rule 2', metric: 'memory_usage', chainUid: 'chain-b', chainName: 'Chain B' },
  ],
  chains: [
    {
      uid: 'chain-a',
      name: 'Chain A',
      interval: '1m',
      intervalSeconds: 60,
      recordingRuleRefs: ['rec-1'],
      alertRuleRefs: [],
    },
    {
      uid: 'chain-b',
      name: 'Chain B',
      interval: '5m',
      intervalSeconds: 300,
      recordingRuleRefs: ['rec-2'],
      alertRuleRefs: [],
    },
  ],
  warnings: ['Multiple chains detected'],
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

describe('MultiChainWarning', () => {
  it('renders warning alert about multiple chains', () => {
    render(<MultiChainWarning detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/multiple evaluation chains detected/i)).toBeInTheDocument();
  });

  it('renders chain selector with detected chains as options', () => {
    render(<MultiChainWarning detection={mockDetection} onOptOut={jest.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/select evaluation chain/i)).toBeInTheDocument();
  });

  it('calls onOptOut when opt-out link is clicked', async () => {
    const user = userEvent.setup();
    const onOptOut = jest.fn();
    render(<MultiChainWarning detection={mockDetection} onOptOut={onOptOut} />, {
      wrapper: makeWrapper(),
    });

    await user.click(
      screen.getByRole('button', { name: /I don't want to use a chain, let me configure evaluation manually/i })
    );

    expect(onOptOut).toHaveBeenCalledTimes(1);
  });
});
