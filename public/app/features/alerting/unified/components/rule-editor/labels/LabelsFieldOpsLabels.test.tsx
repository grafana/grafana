import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor, within } from 'test/test-utils';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { mockAlertRuleApi, setupMswServer } from '../../../mockApi';
import { getGrafanaRule } from '../../../mocks';
import { getMockOpsLabels } from '../../../mocks/server/handlers/plugins/grafana-labels-app';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { LabelsWithSuggestions } from './LabelsField';

// Mock getBoundingClientRect for @tanstack/react-virtual to calculate visible items
// The global ResizeObserver mock in jest-setup.ts handles subsequent measurements
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 200,
  height: 400,
  top: 0,
  left: 0,
  bottom: 400,
  right: 200,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}));

// Existing labels in the form (simulating editing an existing alert rule with ops labels)
const existingOpsLabels = getMockOpsLabels();

// Wrapper that provides portal container for Combobox dropdowns
const TestWrapper = ({
  children,
  labels,
}: React.PropsWithChildren<{ labels: Array<{ key: string; value: string }> }>) => {
  const methods = useForm({ defaultValues: { labelsInSubform: labels } });
  return (
    <>
      <FormProvider {...methods}>{children}</FormProvider>
      <div id="grafana-portal-container" />
    </>
  );
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
      <TestWrapper labels={labels}>
        <LabelsWithSuggestions dataSourceName="grafana" />
      </TestWrapper>
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

  // Test that opening the value dropdown shows values for the CORRECT label key
  // This verifies the async loader is called with the right key and renders the correct options
  it('should show correct label values when opening value dropdown', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Open the first label's value dropdown (sentMail)
    // Expected values: "true", "false"
    const firstValueDropdown = within(screen.getByTestId('labelsInSubform-value-0'));
    await user.click(firstValueDropdown.getByRole('combobox'));

    // Wait for sentMail values to appear
    const trueOption = await screen.findByRole('option', { name: /true/i });
    expect(trueOption).toBeInTheDocument();

    // Verify we have exactly 2 options for sentMail (true, false)
    const firstDropdownOptions = screen.getAllByRole('option');
    expect(firstDropdownOptions).toHaveLength(2);
    expect(firstDropdownOptions[0]).toHaveTextContent('true');
    expect(firstDropdownOptions[1]).toHaveTextContent('false');

    // Close dropdown by clicking outside (simulate real user behavior)
    await user.click(document.body);

    // Open the second label's value dropdown (stage)
    // Expected values: "production", "staging", "development"
    const secondValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));
    await user.click(secondValueDropdown.getByRole('combobox'));

    // Wait for stage values to appear
    const productionOption = await screen.findByRole('option', { name: /production/i });
    expect(productionOption).toBeInTheDocument();

    // Verify we have exactly 3 options for stage (production, staging, development)
    // This ensures we're NOT showing sentMail values
    const secondDropdownOptions = screen.getAllByRole('option');
    expect(secondDropdownOptions).toHaveLength(3);
    expect(secondDropdownOptions[0]).toHaveTextContent('production');
    expect(secondDropdownOptions[1]).toHaveTextContent('staging');
    expect(secondDropdownOptions[2]).toHaveTextContent('development');
  });

  // Test that typing in the value dropdown filters options (search functionality)
  it('should filter value options when typing in the combobox', async () => {
    const { user } = await renderLabelsWithOpsLabels();

    // Add a new label with "stage" key which has multiple values: production, staging, development
    const addMoreButton = await screen.findByText('Add more');
    await user.click(addMoreButton);

    // First, set the key to "stage"
    const keyDropdown = within(screen.getByTestId('labelsInSubform-key-2'));
    await user.type(keyDropdown.getByRole('combobox'), 'stage{enter}');

    // Wait for the key to be set
    const keyInput = screen.getByTestId('labelsInSubform-key-2').querySelector('input');
    await waitFor(() => expect(keyInput).toHaveValue('stage'));

    const valueDropdown = within(screen.getByTestId('labelsInSubform-value-2'));
    const combobox = valueDropdown.getByRole('combobox');

    // Type "stag" which should filter to only "staging" (not "production" or "development")
    await user.type(combobox, 'stag');

    // Wait for the staging option to appear (allows for debounce + async load)
    const stagingOption = await screen.findByRole('option', { name: /staging/i });
    expect(stagingOption).toBeInTheDocument();

    // Verify we have exactly 2 options:
    // 1. "stag" - Use custom value (created because user typed custom text)
    // 2. "staging" - The filtered match from available values
    const allOptions = screen.getAllByRole('option');
    expect(allOptions).toHaveLength(2);
    expect(allOptions[0]).toHaveTextContent('stag');
    expect(allOptions[0]).toHaveTextContent('Use custom value');
    expect(allOptions[1]).toHaveTextContent('staging');

    // Verify that "production" and "development" are NOT shown (they don't match "stag")
    expect(screen.queryByRole('option', { name: /^production$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^development$/i })).not.toBeInTheDocument();
  });
});
