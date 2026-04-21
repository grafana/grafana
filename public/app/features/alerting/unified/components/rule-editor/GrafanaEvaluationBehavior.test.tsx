import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { GrafanaEvaluationBehaviorStep } from './GrafanaEvaluationBehavior';

setupMswServer();

function makeWrapper(featureEnabled = false) {
  const store = configureStore();
  return ({ children }: React.PropsWithChildren<{}>) => {
    const methods = useForm<RuleFormValues>({
      defaultValues: {
        evaluateEvery: '1m',
        evaluateFor: '0s',
        type: RuleFormType.grafana,
        group: 'default-group',
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Error,
        queries: [],
        folder: { uid: 'test-folder', title: 'Test Folder' },
      },
    });

    // Override featureToggles for this test
    config.featureToggles = {
      ...config.featureToggles,
      ['alerting.rulesAPIV2']: featureEnabled,
    };

    return (
      <Provider store={store}>
        <FormProvider {...methods}>{children}</FormProvider>
      </Provider>
    );
  };
}

afterEach(() => {
  // Reset feature flag
  config.featureToggles = {
    ...config.featureToggles,
    ['alerting.rulesAPIV2']: false,
  };
});

describe('GrafanaEvaluationBehaviorStep — feature flag branching', () => {
  it('renders legacy evaluation behavior when alertingRulesAPIV2 flag is disabled', () => {
    render(<GrafanaEvaluationBehaviorStep existing={false} enableProvisionedGroups={false} />, {
      wrapper: makeWrapper(false),
    });

    // Legacy behavior shows group selector
    expect(screen.getByTestId('group-picker')).toBeInTheDocument();
  });

  it('renders EvaluationBehaviorV2 when alertingRulesAPIV2 flag is enabled', async () => {
    render(<GrafanaEvaluationBehaviorStep existing={false} enableProvisionedGroups={false} />, {
      wrapper: makeWrapper(true),
    });

    // V2 shows interval picker without group selector
    expect(await screen.findByRole('textbox', { name: /evaluation interval/i })).toBeInTheDocument();
    expect(screen.queryByTestId('group-picker')).not.toBeInTheDocument();
  });
});
