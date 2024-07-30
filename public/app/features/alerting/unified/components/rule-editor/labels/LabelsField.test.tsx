import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { TestProvider } from 'test/helpers/TestProvider';

import { clearPluginSettingsCache } from 'app/features/plugins/pluginSettings';

import { mockAlertRuleApi, setupMswServer } from '../../../mockApi';
import { getGrafanaRule } from '../../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import LabelsField, { LabelsWithSuggestions } from './LabelsField';

const labels = [
  { key: 'key1', value: 'value1' },
  { key: 'key2', value: 'value2' },
];

const FormProviderWrapper = ({ children }: React.PropsWithChildren<{}>) => {
  const methods = useForm({ defaultValues: { labels } });
  return <FormProvider {...methods}>{children}</FormProvider>;
};
const SubFormProviderWrapper = ({ children }: React.PropsWithChildren<{}>) => {
  const methods = useForm({ defaultValues: { labelsInSubform: labels } });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

function renderAlertLabels() {
  render(
    <FormProviderWrapper>
      <LabelsField />
    </FormProviderWrapper>,
    { wrapper: TestProvider }
  );
}

function renderLabelsWithSuggestions() {
  render(
    <SubFormProviderWrapper>
      <LabelsWithSuggestions dataSourceName="grafana" />
    </SubFormProviderWrapper>,
    { wrapper: TestProvider }
  );
}

const grafanaRule = getGrafanaRule(undefined, {
  uid: 'test-rule-uid',
  title: 'cpu-usage',
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
const server = setupMswServer();
describe('LabelsField with suggestions', () => {
  afterEach(() => {
    server.resetHandlers();
    clearPluginSettingsCache();
  });
  beforeEach(() => {
    mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, {
      [grafanaRule.namespace.name]: [{ name: grafanaRule.group.name, interval: '1m', rules: [grafanaRule.rulerRule!] }],
    });
  });

  it('Should display two dropdowns with the existing labels', async () => {
    renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));

    expect(screen.getByTestId('labelsInSubform-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('labelsInSubform-key-1').textContent).toBe('key2');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    expect(screen.getByTestId('labelsInSubform-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('labelsInSubform-value-1').textContent).toBe('value2');
  });

  it('Should delete a key-value combination', async () => {
    renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    await userEvent.click(screen.getByTestId('delete-label-1'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(1);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(1);
  });

  it('Should add new key-value dropdowns', async () => {
    renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await userEvent.click(screen.getByText('Add more'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(3);

    expect(screen.getByTestId('labelsInSubform-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('labelsInSubform-key-1').textContent).toBe('key2');
    expect(screen.getByTestId('labelsInSubform-key-2').textContent).toBe('Choose key');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(3);

    expect(screen.getByTestId('labelsInSubform-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('labelsInSubform-value-1').textContent).toBe('value2');
    expect(screen.getByTestId('labelsInSubform-value-2').textContent).toBe('Choose value');
  });

  it('Should be able to write new keys and values using the dropdowns', async () => {
    renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await userEvent.click(screen.getByText('Add more'));

    const LastKeyDropdown = within(screen.getByTestId('labelsInSubform-key-2'));
    const LastValueDropdown = within(screen.getByTestId('labelsInSubform-value-2'));

    await userEvent.type(LastKeyDropdown.getByRole('combobox'), 'key3{enter}');
    await userEvent.type(LastValueDropdown.getByRole('combobox'), 'value3{enter}');

    expect(screen.getByTestId('labelsInSubform-key-2').textContent).toBe('key3');
    expect(screen.getByTestId('labelsInSubform-value-2').textContent).toBe('value3');
  });
  it('Should be able to write new keys and values using the dropdowns, case sensitive', async () => {
    renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));
    expect(screen.getByTestId('labelsInSubform-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('labelsInSubform-key-1').textContent).toBe('key2');
    expect(screen.getByTestId('labelsInSubform-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('labelsInSubform-value-1').textContent).toBe('value2');

    const LastKeyDropdown = within(screen.getByTestId('labelsInSubform-key-1'));
    const LastValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));

    await userEvent.type(LastKeyDropdown.getByRole('combobox'), 'KEY2{enter}');
    expect(screen.getByTestId('labelsInSubform-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('labelsInSubform-key-1').textContent).toBe('KEY2');

    await userEvent.type(LastValueDropdown.getByRole('combobox'), 'VALUE2{enter}');
    expect(screen.getByTestId('labelsInSubform-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('labelsInSubform-value-1').textContent).toBe('VALUE2');
  });
});

describe('LabelsField without suggestions', () => {
  it('Should display two inputs without label suggestions', async () => {
    renderAlertLabels();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-input-wrapper')).toHaveLength(2));
    expect(screen.queryAllByTestId('alertlabel-key-picker')).toHaveLength(0);

    expect(screen.getByTestId('label-key-0')).toHaveValue('key1');
    expect(screen.getByTestId('label-key-1')).toHaveValue('key2');

    expect(screen.getByTestId('label-value-0')).toHaveValue('value1');
    expect(screen.getByTestId('label-value-1')).toHaveValue('value2');
  });
});
