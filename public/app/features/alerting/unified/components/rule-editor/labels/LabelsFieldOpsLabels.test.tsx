import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { mockAlertRuleApi, setupMswServer } from '../../../mockApi';
import { getGrafanaRule } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { LabelsWithSuggestions } from './LabelsField';

// Existing labels in the form (simulating editing an existing alert rule with ops labels)
const existingOpsLabels = [
  { key: 'sentMail', value: 'true' },
  { key: 'stage', value: 'production' },
];

const SubFormProviderWrapper = ({
  children,
  labels,
}: React.PropsWithChildren<{ labels: Array<{ key: string; value: string }> }>) => {
  const methods = useForm({ defaultValues: { labelsInSubform: labels } });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const grafanaRule = getGrafanaRule(undefined, {
  uid: 'test-rule-uid',
  title: 'test-alert',
  namespace_uid: 'folderUID1',
  data: [
    {
      refId: 'A',
      datasourceUid: 'uid1',
      queryType: 'alerting',
      relativeTimeRange: { from: 1000, to: 2000 },
      model: {
        refId: 'A',
        expression: 'vector(1)',
        queryType: 'alerting',
        datasource: { uid: 'uid1', type: 'prometheus' },
      },
    },
  ],
});

// Use the standard MSW server setup which includes all plugin handlers
const server = setupMswServer();

describe('LabelsField with ops labels (escalation #19378)', () => {
  beforeEach(() => {
    // Mock the ruler rules API
    mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, {
      [grafanaRule.namespace.name]: [{ name: grafanaRule.group.name, interval: '1m', rules: [grafanaRule.rulerRule!] }],
    });
  });

  afterEach(() => {
    server.resetHandlers();
    clearPluginSettingsCache();
  });

  async function renderLabelsWithOpsLabels(labels = existingOpsLabels) {
    const view = render(
      <SubFormProviderWrapper labels={labels}>
        <LabelsWithSuggestions dataSourceName="grafana" />
      </SubFormProviderWrapper>
    );

    // Wait for the dropdowns to be rendered
    await waitFor(() => {
      expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(labels.length);
    });

    return view;
  }

  it('should display existing ops labels correctly', async () => {
    await renderLabelsWithOpsLabels();

    // Verify the keys are displayed
    expect(screen.getByTestId('labelsInSubform-key-0').querySelector('input')).toHaveValue('sentMail');
    expect(screen.getByTestId('labelsInSubform-key-1').querySelector('input')).toHaveValue('stage');

    // Verify the values are displayed
    expect(screen.getByTestId('labelsInSubform-value-0').querySelector('input')).toHaveValue('true');
    expect(screen.getByTestId('labelsInSubform-value-1').querySelector('input')).toHaveValue('production');
  });

  it('should render value dropdowns for each label', async () => {
    await renderLabelsWithOpsLabels();

    // Verify we have value pickers for each label
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);
  });

  it('should allow deleting a label', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2);

    await user.click(screen.getByTestId('delete-label-1'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(1);
    expect(screen.getByTestId('labelsInSubform-key-0').querySelector('input')).toHaveValue('sentMail');
  });

  it('should allow adding a new label', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await user.click(screen.getByText('Add more'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(3);
    expect(screen.getByTestId('labelsInSubform-key-2').querySelector('input')).toHaveValue('');
  });

  it('should allow typing custom values in dropdowns', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Add a new label
    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await user.click(screen.getByText('Add more'));

    // Type a custom key and value
    const newKeyInput = screen.getByTestId('labelsInSubform-key-2').querySelector('input');
    const newValueInput = screen.getByTestId('labelsInSubform-value-2').querySelector('input');

    await user.type(newKeyInput!, 'customKey{enter}');
    await user.type(newValueInput!, 'customValue{enter}');

    await waitFor(() => {
      expect(screen.getByTestId('labelsInSubform-key-2').querySelector('input')).toHaveValue('customKey');
    });
    expect(screen.getByTestId('labelsInSubform-value-2').querySelector('input')).toHaveValue('customValue');
  });
});
