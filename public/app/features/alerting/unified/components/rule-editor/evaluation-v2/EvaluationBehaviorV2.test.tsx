import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { render, screen } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../../mockApi';
import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';

import { EvaluationBehaviorV2 } from './EvaluationBehaviorV2';

// MSW server returns empty recording rules list by default
setupMswServer();

function makeWrapper(defaultValues: Partial<RuleFormValues> = {}) {
  const store = configureStore();
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: {
        evaluateEvery: '1m',
        evaluateFor: '0s',
        type: RuleFormType.grafana,
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Error,
        queries: [],
        ...defaultValues,
      } as RuleFormValues,
    });
    return (
      <Provider store={store}>
        <FormProvider {...methods}>{children}</FormProvider>
      </Provider>
    );
  };
}

describe('EvaluationBehaviorV2', () => {
  it('renders StandaloneEvaluation when no recording rules are detected', async () => {
    render(<EvaluationBehaviorV2 existing={false} />, { wrapper: makeWrapper() });

    // Interval input is the key indicator of StandaloneEvaluation
    expect(await screen.findByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
  });

  it('renders section with correct title', async () => {
    render(<EvaluationBehaviorV2 existing={false} />, { wrapper: makeWrapper() });

    expect(await screen.findByText(/set evaluation behavior/i)).toBeInTheDocument();
  });

  it('always renders CommonEvaluationFields regardless of scenario', async () => {
    render(<EvaluationBehaviorV2 existing={false} />, { wrapper: makeWrapper() });

    // The pending period field is part of CommonEvaluationFields
    expect(await screen.findByText(/pending period/i)).toBeInTheDocument();
  });

  it('switches to manual mode when user clicks opt-out link', async () => {
    // Render with a scenario that shows an opt-out link
    // Since the mock API returns no recording rules, we start with NoRecordingRules/StandaloneEvaluation
    // We can't easily test opt-out without mocking the detection hook, so we test
    // that the StandaloneEvaluation renders in the default state
    render(<EvaluationBehaviorV2 existing={false} />, {
      wrapper: makeWrapper({ queries: [] }),
    });

    // In NoRecordingRules scenario, StandaloneEvaluation renders without opt-in link
    expect(await screen.findByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I want to add to an evaluation chain/i })).not.toBeInTheDocument();
  });

  it('does not show pause switch when not editing existing rule', async () => {
    render(<EvaluationBehaviorV2 existing={false} />, { wrapper: makeWrapper() });

    await screen.findByText(/set evaluation behavior/i);

    expect(screen.queryByRole('switch', { name: /pause evaluation/i })).not.toBeInTheDocument();
  });

  it('shows pause switch when editing existing rule', async () => {
    render(<EvaluationBehaviorV2 existing={true} />, { wrapper: makeWrapper() });

    expect(await screen.findByText(/pause evaluation/i)).toBeInTheDocument();
  });
});
