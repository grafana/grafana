import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdHocFilterWithLabels } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';

import {
  ALL_SENTINEL_VALUE,
  createAllFilter,
  DefaultFiltersEditor,
  type DefaultFiltersEditorProps,
  isAllFilter,
} from './DefaultFiltersEditor';

mockBoundingClientRect();

function setup(props: Partial<DefaultFiltersEditorProps> = {}) {
  const onChange = jest.fn();
  const getKeyOptions = jest.fn().mockResolvedValue([
    { label: 'RVP Region', value: 'territory_navigator.rvp_region' },
    { label: 'region', value: 'region' },
    { label: 'cluster', value: 'cluster' },
  ]);
  const getValueOptions = jest.fn().mockResolvedValue([
    { label: 'emea', value: 'emea' },
    { label: 'amer', value: 'amer' },
  ]);
  const getOperatorOptions = jest.fn().mockReturnValue([
    { label: '=', value: '=', description: 'Equals' },
    { label: '!=', value: '!=', description: 'Not equal' },
    { label: '=|', value: '=|', description: 'One of' },
  ]);

  const utils = render(
    <DefaultFiltersEditor
      filters={[]}
      onChange={onChange}
      getKeyOptions={getKeyOptions}
      getValueOptions={getValueOptions}
      getOperatorOptions={getOperatorOptions}
      {...props}
    />
  );

  return { onChange, getKeyOptions, getValueOptions, getOperatorOptions, ...utils };
}

describe('DefaultFiltersEditor', () => {
  it('adds a default filter without values as a one-of All ($__all) filter', async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByTestId('default-filters-editor-add'));
    await userEvent.click(screen.getByTestId('default-filters-editor-key-new'));
    await userEvent.click(await screen.findByRole('option', { name: 'region' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        operator: '=|',
        value: ALL_SENTINEL_VALUE,
        values: [ALL_SENTINEL_VALUE],
        valueLabels: ['All'],
        origin: 'dashboard',
      }),
    ]);
    expect(onChange.mock.calls[0][0][0].keyLabel).toBeUndefined();
  });

  it('adds an empty equals row when multi-value operators are unsupported', async () => {
    const { onChange } = setup({
      getOperatorOptions: jest.fn().mockReturnValue([
        { label: '=', value: '=' },
        { label: '!=', value: '!=' },
      ]),
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-add'));
    await userEvent.click(screen.getByTestId('default-filters-editor-key-new'));
    await userEvent.click(await screen.findByRole('option', { name: 'region' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'region', operator: '=', value: '', origin: 'dashboard' }),
    ]);
    expect(onChange.mock.calls[0][0][0].values).toBeUndefined();
  });

  it('prefills the display name from the datasource-provided key label', async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByTestId('default-filters-editor-add'));
    await userEvent.click(screen.getByTestId('default-filters-editor-key-new'));
    await userEvent.click(await screen.findByRole('option', { name: 'RVP Region' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'territory_navigator.rvp_region',
        keyLabel: 'RVP Region',
        origin: 'dashboard',
      }),
    ]);
  });

  it('shows the existing display name in the input', () => {
    setup({ filters: [createAllFilter('territory_navigator.rvp_region', 'RVP Region')] });

    expect(screen.getByRole('textbox', { name: 'Filter display name' })).toHaveValue('RVP Region');
  });

  it('overwrites the display name on blur', async () => {
    const { onChange } = setup({ filters: [createAllFilter('territory_navigator.rvp_region', 'RVP Region')] });

    const input = screen.getByRole('textbox', { name: 'Filter display name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Sales Region');
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'territory_navigator.rvp_region', keyLabel: 'Sales Region' }),
    ]);
  });

  it('removes the keyLabel override when the display name is cleared', async () => {
    const { onChange } = setup({ filters: [createAllFilter('territory_navigator.rvp_region', 'RVP Region')] });

    const input = screen.getByRole('textbox', { name: 'Filter display name' });
    await userEvent.clear(input);
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated: AdHocFilterWithLabels[] = onChange.mock.calls[0][0];
    expect(updated[0].key).toBe('territory_navigator.rvp_region');
    expect(updated[0]).not.toHaveProperty('keyLabel');
  });

  it('offers an All option in the values picker for the one-of operator', async () => {
    setup({
      filters: [
        {
          key: 'region',
          operator: '=|',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));

    expect(await screen.findByRole('option', { name: 'All' })).toBeInTheDocument();
  });

  it('does not offer All for other operators', async () => {
    setup({
      filters: [
        {
          key: 'region',
          operator: '=',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));

    expect(await screen.findByRole('option', { name: 'amer' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'All' })).not.toBeInTheDocument();
  });

  it('replaces selected values with the $__all sentinel when All is picked', async () => {
    const { onChange } = setup({
      filters: [
        {
          key: 'region',
          keyLabel: 'Region',
          operator: '=|',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'All' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        keyLabel: 'Region',
        operator: '=|',
        value: ALL_SENTINEL_VALUE,
        values: [ALL_SENTINEL_VALUE],
        valueLabels: ['All'],
        origin: 'dashboard',
      }),
    ]);
  });

  it('drops the $__all sentinel when a concrete value is picked', async () => {
    const { onChange } = setup({ filters: [createAllFilter('region', 'Region')] });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'emea' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        keyLabel: 'Region',
        operator: '=|',
        value: 'emea',
        values: ['emea'],
        valueLabels: ['emea'],
        origin: 'dashboard',
      }),
    ]);
  });

  it('falls back to the All filter when all values are deselected', async () => {
    const { onChange } = setup({
      filters: [
        {
          key: 'region',
          keyLabel: 'Region',
          operator: '=|',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'emea' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'region', keyLabel: 'Region', operator: '=|', values: [ALL_SENTINEL_VALUE] }),
    ]);
  });

  it('updates the operator from the operator picker', async () => {
    const { onChange } = setup({
      filters: [
        {
          key: 'region',
          operator: '=',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-operator-region'));
    await userEvent.click(await screen.findByRole('option', { name: /!=/ }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'region', operator: '!=', value: 'emea' })]);
  });

  it('clears the sentinel when an All filter moves off the one-of operator', async () => {
    const { onChange } = setup({ filters: [createAllFilter('region', 'Region')] });

    await userEvent.click(screen.getByTestId('default-filters-editor-operator-region'));
    await userEvent.click(await screen.findByRole('option', { name: /!=/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0][0];
    expect(updated).toMatchObject({ key: 'region', keyLabel: 'Region', operator: '!=', value: '' });
    expect(updated.values).toBeUndefined();
    expect(updated.valueLabels).toBeUndefined();
  });

  it('becomes All when an empty row moves onto the one-of operator', async () => {
    const { onChange } = setup({
      filters: [{ key: 'region', keyLabel: 'Region', operator: '=', value: '', origin: 'dashboard' }],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-operator-region'));
    const options = await screen.findAllByRole('option');
    await userEvent.click(options.find((el) => el.textContent?.startsWith('=|'))!);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        keyLabel: 'Region',
        operator: '=|',
        values: [ALL_SENTINEL_VALUE],
        valueLabels: ['All'],
      }),
    ]);
  });

  it('truncates to a single value when switching to a single-value operator', async () => {
    const { onChange } = setup({
      filters: [
        {
          key: 'region',
          operator: '=|',
          value: 'emea',
          values: ['emea', 'amer'],
          valueLabels: ['emea', 'amer'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-operator-region'));
    const equalsOptions = await screen.findAllByRole('option');
    await userEvent.click(equalsOptions.find((el) => el.textContent?.startsWith('='))!);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ operator: '=', value: 'emea', values: ['emea'], valueLabels: ['emea'] }),
    ]);
  });

  it('keeps only the most recent value for single-value operators', async () => {
    const { onChange } = setup({
      filters: [
        {
          key: 'region',
          operator: '=',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['emea'],
          origin: 'dashboard',
        },
      ],
    });

    await userEvent.click(screen.getByTestId('default-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'amer' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ operator: '=', value: 'amer', values: ['amer'] }),
    ]);
  });

  it('excludes already-configured keys from the key options', async () => {
    setup({ filters: [createAllFilter('region')] });

    await userEvent.click(screen.getByTestId('default-filters-editor-add'));
    await userEvent.click(screen.getByTestId('default-filters-editor-key-new'));

    expect(await screen.findByRole('option', { name: 'cluster' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'region' })).not.toBeInTheDocument();
  });

  it('removes a default filter', async () => {
    const { onChange } = setup({
      filters: [createAllFilter('region', 'Region'), createAllFilter('cluster')],
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Remove default filter' });
    await userEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'cluster' })]);
  });
});

describe('createAllFilter/isAllFilter', () => {
  it('creates a dashboard-origin one-of All filter and omits keyLabel when it matches the key', () => {
    expect(createAllFilter('region')).toEqual({
      key: 'region',
      operator: '=|',
      value: ALL_SENTINEL_VALUE,
      values: [ALL_SENTINEL_VALUE],
      valueLabels: ['All'],
      origin: 'dashboard',
    });
    expect(createAllFilter('region', 'region')).not.toHaveProperty('keyLabel');
    expect(createAllFilter('region', 'Region').keyLabel).toBe('Region');
  });

  it('detects the sentinel only with the one-of operator, like scenes isAllValueFilter', () => {
    expect(isAllFilter(createAllFilter('region'))).toBe(true);
    expect(isAllFilter({ key: 'region', operator: '=|', value: 'emea', values: ['emea'] })).toBe(false);
    // $__all with any other operator is a literal value, not All
    expect(isAllFilter({ key: 'region', operator: '=', value: ALL_SENTINEL_VALUE })).toBe(false);
    expect(
      isAllFilter({ key: 'region', operator: '!=|', value: ALL_SENTINEL_VALUE, values: [ALL_SENTINEL_VALUE] })
    ).toBe(false);
  });
});
