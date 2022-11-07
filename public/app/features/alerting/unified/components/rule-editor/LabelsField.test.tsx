import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import LabelsField from './LabelsField';

const labels = [
  { key: 'key1', value: 'value1' },
  { key: 'key2', value: 'value2' },
];

const FormProviderWrapper: React.FC = ({ children }) => {
  const methods = useForm({ defaultValues: { labels } });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

function renderAlertLabels(dataSourceName?: string) {
  const store = configureStore({});

  render(
    <Provider store={store}>
      {dataSourceName ? <LabelsField dataSourceName={dataSourceName} /> : <LabelsField />}
    </Provider>,
    { wrapper: FormProviderWrapper }
  );
}

describe('LabelsField with suggestions', () => {
  it('Should display two dropdowns with the existing labels', async () => {
    renderAlertLabels('grafana');

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));

    expect(screen.getByTestId('label-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('label-key-1').textContent).toBe('key2');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    expect(screen.getByTestId('label-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('label-value-1').textContent).toBe('value2');
  });

  it('Should delete a key-value combination', async () => {
    renderAlertLabels('grafana');

    await waitFor(() => expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    await userEvent.click(screen.getByTestId('delete-label-1'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(1);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(1);
  });

  it('Should add new key-value dropdowns', async () => {
    renderAlertLabels('grafana');

    await waitFor(() => expect(screen.getByText('Add label')).toBeVisible());
    await userEvent.click(screen.getByText('Add label'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(3);

    expect(screen.getByTestId('label-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('label-key-1').textContent).toBe('key2');
    expect(screen.getByTestId('label-key-2').textContent).toBe('Choose key');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(3);

    expect(screen.getByTestId('label-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('label-value-1').textContent).toBe('value2');
    expect(screen.getByTestId('label-value-2').textContent).toBe('Choose value');
  });

  it('Should be able to write new keys and values using the dropdowns', async () => {
    renderAlertLabels('grafana');

    await waitFor(() => expect(screen.getByText('Add label')).toBeVisible());
    await userEvent.click(screen.getByText('Add label'));

    const LastKeyDropdown = within(screen.getByTestId('label-key-2'));
    const LastValueDropdown = within(screen.getByTestId('label-value-2'));

    await userEvent.type(LastKeyDropdown.getByRole('combobox'), 'key3{enter}');
    await userEvent.type(LastValueDropdown.getByRole('combobox'), 'value3{enter}');

    expect(screen.getByTestId('label-key-2').textContent).toBe('key3');
    expect(screen.getByTestId('label-value-2').textContent).toBe('value3');
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
