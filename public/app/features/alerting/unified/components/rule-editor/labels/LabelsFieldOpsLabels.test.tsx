import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor, within } from 'test/test-utils';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { mockAlertRuleApi, setupMswServer } from '../../../mockApi';
import { getGrafanaRule } from '../../../mocks';
import {
  defaultLabelValues,
  getLabelValuesHandler,
  getMockOpsLabels,
} from '../../../mocks/server/handlers/plugins/grafana-labels-app';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { LabelsWithSuggestions } from './LabelsField';

// Existing labels in the form (simulating editing an existing alert rule with ops labels)
const existingOpsLabels = getMockOpsLabels();

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

describe('LabelsField with ops labels', () => {
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
    expect(screen.getByTestId('labelsInSubform-key-0').querySelector('input')).toHaveValue(existingOpsLabels[0].key);
    expect(screen.getByTestId('labelsInSubform-key-1').querySelector('input')).toHaveValue(existingOpsLabels[1].key);

    // Verify the values are displayed
    expect(screen.getByTestId('labelsInSubform-value-0').querySelector('input')).toHaveValue(
      existingOpsLabels[0].value
    );
    expect(screen.getByTestId('labelsInSubform-value-1').querySelector('input')).toHaveValue(
      existingOpsLabels[1].value
    );
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
    expect(screen.getByTestId('labelsInSubform-key-0').querySelector('input')).toHaveValue(existingOpsLabels[0].key);
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

  // When editing an existing alert with labels, the value dropdown should open and be interactive
  it('should allow opening and interacting with existing label value dropdown', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Click on the first label's value dropdown (sentMail) to open it
    const firstValueDropdown = within(screen.getByTestId('labelsInSubform-value-0'));
    const combobox = firstValueDropdown.getByRole('combobox');

    // Verify initial value is set
    expect(combobox).toHaveValue(existingOpsLabels[0].value);

    // Open the dropdown
    await user.click(combobox);

    // Verify dropdown is open (not showing "No options found" state)
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    // Close and reopen to verify it remains interactive
    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
  });

  // Test that value dropdowns can be opened and interacted with for different label keys
  // Note: Dropdown content cannot be verified via text due to Combobox virtualization in JSDOM
  it('should allow opening value dropdowns for different label keys', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Open the first label's value dropdown (sentMail)
    const firstValueDropdown = within(screen.getByTestId('labelsInSubform-value-0'));
    const firstCombobox = firstValueDropdown.getByRole('combobox');
    await user.click(firstCombobox);

    // Verify dropdown is open
    expect(firstCombobox).toHaveAttribute('aria-expanded', 'true');

    // Close and open second dropdown
    await user.keyboard('{Escape}');

    // Open the second label's value dropdown (stage)
    const secondValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));
    const secondCombobox = secondValueDropdown.getByRole('combobox');
    await user.click(secondCombobox);

    // Verify second dropdown is open
    expect(secondCombobox).toHaveAttribute('aria-expanded', 'true');
  });

  // Test that after deleting and re-adding a label, the value dropdown can be opened
  it('should allow opening value dropdown after deleting and re-adding a label', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Delete the second label (stage)
    await user.click(screen.getByTestId('delete-label-1'));
    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(1);

    // Add a new label
    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await user.click(screen.getByText('Add more'));

    // Set the new label key to 'team'
    const newKeyDropdown = within(screen.getByTestId('labelsInSubform-key-1'));
    await user.type(newKeyDropdown.getByRole('combobox'), 'team{enter}');

    // Verify the key was set
    await waitFor(() => {
      expect(screen.getByTestId('labelsInSubform-key-1').querySelector('input')).toHaveValue('team');
    });

    // Open the new label's value dropdown
    const newValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));
    const combobox = newValueDropdown.getByRole('combobox');
    await user.click(combobox);

    // Verify dropdown is open
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
  });

  // Test that opening the value dropdown requests values for the CORRECT label key
  // This verifies the async loader is called with the right key
  it('should request correct label values when opening value dropdown', async () => {
    const requestedKeys: string[] = [];

    // Add a spy handler that tracks which keys are requested
    server.use(getLabelValuesHandler(defaultLabelValues, (key) => requestedKeys.push(key)));

    const { user } = await renderLabelsWithOpsLabels();

    // Open the first label's value dropdown (sentMail)
    const firstValueDropdown = within(screen.getByTestId('labelsInSubform-value-0'));
    await user.click(firstValueDropdown.getByRole('combobox'));

    // Wait for the API call to be made
    await waitFor(() => {
      expect(requestedKeys).toContain('sentMail');
    });

    // Close dropdown
    await user.keyboard('{Escape}');

    // Clear the tracked keys
    requestedKeys.length = 0;

    // Open the second label's value dropdown (stage)
    const secondValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));
    await user.click(secondValueDropdown.getByRole('combobox'));

    // Wait for the API call - should request 'stage', NOT 'sentMail'
    await waitFor(() => {
      expect(requestedKeys).toContain('stage');
    });

    // Verify we didn't request the wrong key (the bug from escalation #19378)
    expect(requestedKeys).not.toContain('sentMail');
  });
});
