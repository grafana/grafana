import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor, waitForElementToBeRemoved, within } from 'test/test-utils';

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
  return render(
    <FormProviderWrapper>
      <LabelsField />
    </FormProviderWrapper>
  );
}

async function renderLabelsWithSuggestions() {
  const view = render(
    <SubFormProviderWrapper>
      <LabelsWithSuggestions dataSourceName="grafana" />
    </SubFormProviderWrapper>
  );
  await waitForElementToBeRemoved(() => screen.queryByText('Loading existing labels'));

  return view;
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

  jest.retryTimes(2);

  it('Should display two dropdowns with the existing labels', async () => {
    await renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));

    expect(screen.getByTestId('labelsInSubform-key-0')).toHaveTextContent('key1');
    expect(screen.getByTestId('labelsInSubform-key-1')).toHaveTextContent('key2');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    expect(screen.getByTestId('labelsInSubform-value-0')).toHaveTextContent('value1');
    expect(screen.getByTestId('labelsInSubform-value-1')).toHaveTextContent('value2');
  });

  it('Should delete a key-value combination', async () => {
    const { user } = await renderLabelsWithSuggestions();

    expect(await screen.findAllByTestId('alertlabel-key-picker')).toHaveLength(2);
    expect(await screen.findAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    await user.click(screen.getByTestId('delete-label-1'));

    expect(await screen.findAllByTestId('alertlabel-key-picker')).toHaveLength(1);
    expect(await screen.findAllByTestId('alertlabel-value-picker')).toHaveLength(1);
  });

  it('Should add new key-value dropdowns', async () => {
    const { user } = await renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await user.click(screen.getByText('Add more'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(3);

    expect(screen.getByTestId('labelsInSubform-key-0')).toHaveTextContent('key1');
    expect(screen.getByTestId('labelsInSubform-key-1')).toHaveTextContent('key2');
    expect(screen.getByTestId('labelsInSubform-key-2')).toHaveTextContent('Choose key');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(3);

    expect(screen.getByTestId('labelsInSubform-value-0')).toHaveTextContent('value1');
    expect(screen.getByTestId('labelsInSubform-value-1')).toHaveTextContent('value2');
    expect(screen.getByTestId('labelsInSubform-value-2')).toHaveTextContent('Choose value');
  });

  it('Should be able to write new keys and values using the dropdowns', async () => {
    const { user } = await renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getByText('Add more')).toBeVisible());
    await user.click(screen.getByText('Add more'));

    const LastKeyDropdown = within(screen.getByTestId('labelsInSubform-key-2'));
    const LastValueDropdown = within(screen.getByTestId('labelsInSubform-value-2'));

    await user.type(LastKeyDropdown.getByRole('combobox'), 'key3{enter}');
    await user.type(LastValueDropdown.getByRole('combobox'), 'value3{enter}');

    expect(screen.getByTestId('labelsInSubform-key-2')).toHaveTextContent('key3');
    expect(screen.getByTestId('labelsInSubform-value-2')).toHaveTextContent('value3');
  });
  it('Should be able to write new keys and values using the dropdowns, case sensitive', async () => {
    const { user } = await renderLabelsWithSuggestions();

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));
    expect(screen.getByTestId('labelsInSubform-key-0')).toHaveTextContent('key1');
    expect(screen.getByTestId('labelsInSubform-key-1')).toHaveTextContent('key2');
    expect(screen.getByTestId('labelsInSubform-value-0')).toHaveTextContent('value1');
    expect(screen.getByTestId('labelsInSubform-value-1')).toHaveTextContent('value2');

    const LastKeyDropdown = within(screen.getByTestId('labelsInSubform-key-1'));
    const LastValueDropdown = within(screen.getByTestId('labelsInSubform-value-1'));

    await user.type(LastKeyDropdown.getByRole('combobox'), 'KEY2{enter}');
    expect(screen.getByTestId('labelsInSubform-key-0')).toHaveTextContent('key1');
    expect(screen.getByTestId('labelsInSubform-key-1')).toHaveTextContent('KEY2');

    await user.type(LastValueDropdown.getByRole('combobox'), 'VALUE2{enter}');
    expect(screen.getByTestId('labelsInSubform-value-0')).toHaveTextContent('value1');
    expect(screen.getByTestId('labelsInSubform-value-1')).toHaveTextContent('VALUE2');
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
