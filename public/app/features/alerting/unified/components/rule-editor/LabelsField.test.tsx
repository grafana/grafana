import { render, screen, within } from '@testing-library/react';
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

function renderAlertLabelsPicker() {
  const store = configureStore({});

  render(
    <Provider store={store}>
      <LabelsField />
    </Provider>,
    { wrapper: FormProviderWrapper }
  );
}

describe('AlertLabelsPicker', () => {
  it('Should display two dropdowns with the existing labels', async () => {
    renderAlertLabelsPicker();

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2);

    expect(screen.getByTestId('label-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('label-key-1').textContent).toBe('key2');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    expect(screen.getByTestId('label-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('label-value-1').textContent).toBe('value2');
  });

  it('Should delete a key-value combination', async () => {
    renderAlertLabelsPicker();

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(2);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(2);

    await userEvent.click(screen.getByTestId('delete-label-1'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(1);
    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(1);
  });

  it('Should add new key-value dropdowns', async () => {
    renderAlertLabelsPicker();

    await userEvent.click(screen.getByText('Add label'));

    expect(screen.getAllByTestId('alertlabel-key-picker')).toHaveLength(3);

    expect(screen.getByTestId('label-key-0').textContent).toBe('key1');
    expect(screen.getByTestId('label-key-1').textContent).toBe('key2');
    expect(screen.getByTestId('label-key-2').textContent).toBe('');

    expect(screen.getAllByTestId('alertlabel-value-picker')).toHaveLength(3);

    expect(screen.getByTestId('label-value-0').textContent).toBe('value1');
    expect(screen.getByTestId('label-value-1').textContent).toBe('value2');
    expect(screen.getByTestId('label-value-2').textContent).toBe('');
  });

  it('Should be able to write new keys and values using the dropdowns', async () => {
    renderAlertLabelsPicker();

    await userEvent.click(screen.getByText('Add label'));

    const LastKeyDropdown = within(screen.getByTestId('label-key-2'));
    const LastValueDropdown = within(screen.getByTestId('label-value-2'));

    await userEvent.type(LastKeyDropdown.getByRole('combobox'), 'key3{enter}');
    await userEvent.type(LastValueDropdown.getByRole('combobox'), 'value3{enter}');

    expect(screen.getByTestId('label-key-2').textContent).toBe('key3');
    expect(screen.getByTestId('label-value-2').textContent).toBe('value3');
  });
});
