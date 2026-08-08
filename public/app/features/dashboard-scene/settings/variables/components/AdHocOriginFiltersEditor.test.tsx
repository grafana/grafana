import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdHocFilterWithLabels, type AdHocFiltersController } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { AdHocOriginFiltersEditor, toComboboxOptions } from './AdHocOriginFiltersEditor';

const keyOptions = [
  { label: 'CPU Usage', value: 'cpu_usage' },
  { label: 'host', value: 'host' },
];

const valueOptions = [
  { label: 'prod', value: 'prod' },
  { label: 'dev', value: 'dev' },
];

const operatorOptions = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '=|', value: '=|', description: 'One of. Use to filter on multiple values.' },
];

function setup(filters: AdHocFilterWithLabels[] = []) {
  const updateFilters = jest.fn();

  const controller: AdHocFiltersController = {
    useState: () => ({ filters, allowCustomValue: true }),
    getKeys: jest.fn().mockResolvedValue(keyOptions),
    getValuesFor: jest.fn().mockResolvedValue(valueOptions),
    getOperators: jest.fn().mockReturnValue(operatorOptions),
    updateFilters,
    updateFilter: jest.fn(),
    updateToMatchAll: jest.fn(),
    removeFilter: jest.fn(),
    removeLastFilter: jest.fn(),
    handleComboboxBackspace: jest.fn(),
    addWip: jest.fn(),
    restoreOriginalFilter: jest.fn(),
  };

  const renderResult = render(<AdHocOriginFiltersEditor controller={controller} />);

  return { controller, updateFilters, user: userEvent.setup(), renderResult };
}

function getRows() {
  return screen.queryAllByTestId('default-filter-row');
}

describe('AdHocOriginFiltersEditor', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('should render the field label and description', () => {
    setup();

    expect(screen.getByText('Default filters')).toBeInTheDocument();
    expect(screen.getByText('Filters that are pre-selected by default.')).toBeInTheDocument();
    expect(getRows()).toHaveLength(0);
  });

  it('should render a row per existing filter', () => {
    setup([
      { key: 'cpu_usage', keyLabel: 'CPU Usage', operator: '=', value: 'prod', valueLabels: ['prod'] },
      { key: 'host', operator: '!=', value: 'dev', valueLabels: ['dev'] },
    ]);

    expect(getRows()).toHaveLength(2);

    expect(screen.getByLabelText('Default filter 1 key')).toHaveValue('cpu_usage');
    expect(screen.getByLabelText('Default filter 1 label')).toHaveValue('CPU Usage');
    expect(screen.getByLabelText('Default filter 1 operator')).toHaveValue('=');
    expect(screen.getByLabelText('Default filter 1 value')).toHaveValue('prod');

    expect(screen.getByLabelText('Default filter 2 key')).toHaveValue('host');
    expect(screen.getByLabelText('Default filter 2 operator')).toHaveValue('!=');
    expect(screen.getByLabelText('Default filter 2 value')).toHaveValue('dev');
  });

  it('should show an empty label input when the key label only repeats the key', () => {
    setup([{ key: 'host', keyLabel: 'host', operator: '=', value: 'dev' }]);

    expect(screen.getByLabelText('Default filter 1 label')).toHaveValue('');
  });

  it('should add an empty row without applying it as a filter', async () => {
    const { user, updateFilters } = setup();

    await user.click(screen.getByTestId('default-filters-add-button'));

    expect(getRows()).toHaveLength(1);
    expect(screen.getByLabelText('Default filter 1 operator')).toHaveValue('=');
    expect(updateFilters).not.toHaveBeenCalled();
  });

  it('should apply a filter once both key and value are picked, keeping the data source key label', async () => {
    const { user, updateFilters } = setup();

    await user.click(screen.getByTestId('default-filters-add-button'));

    await user.click(screen.getByLabelText('Default filter 1 key'));
    await user.click(await screen.findByRole('option', { name: 'CPU Usage' }));

    // key alone is not enough to apply the filter
    expect(updateFilters).toHaveBeenCalledWith([]);
    expect(screen.getByLabelText('Default filter 1 label')).toHaveValue('CPU Usage');

    await user.click(screen.getByLabelText('Default filter 1 value'));
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    expect(updateFilters).toHaveBeenLastCalledWith([
      {
        key: 'cpu_usage',
        keyLabel: 'CPU Usage',
        operator: '=',
        value: 'prod',
        valueLabels: ['prod'],
        origin: 'dashboard',
      },
    ]);
  });

  it('should not set a key label when the data source label matches the key', async () => {
    const { user, updateFilters } = setup();

    await user.click(screen.getByTestId('default-filters-add-button'));

    await user.click(screen.getByLabelText('Default filter 1 key'));
    await user.click(await screen.findByRole('option', { name: 'host' }));

    await user.click(screen.getByLabelText('Default filter 1 value'));
    await user.click(await screen.findByRole('option', { name: 'dev' }));

    expect(updateFilters).toHaveBeenLastCalledWith([expect.objectContaining({ key: 'host', value: 'dev' })]);
    expect(updateFilters.mock.lastCall[0][0].keyLabel).toBeUndefined();
    expect(screen.getByLabelText('Default filter 1 label')).toHaveValue('');
  });

  it('should let the user overwrite the key label', async () => {
    const { user, updateFilters } = setup([{ key: 'host', operator: '=', value: 'dev', origin: 'dashboard' }]);

    await user.type(screen.getByLabelText('Default filter 1 label'), 'Host');

    expect(updateFilters).toHaveBeenLastCalledWith([expect.objectContaining({ key: 'host', keyLabel: 'Host' })]);

    await user.clear(screen.getByLabelText('Default filter 1 label'));

    expect(updateFilters.mock.lastCall[0][0].keyLabel).toBeUndefined();
  });

  it('should render a multi value control and carry the value over when a multi value operator is picked', async () => {
    const { user, updateFilters } = setup([
      { key: 'host', operator: '=', value: 'dev', valueLabels: ['dev'], origin: 'dashboard' },
    ]);

    await user.click(screen.getByLabelText('Default filter 1 operator'));
    await user.click(await screen.findByRole('option', { name: /=\|/ }));

    expect(updateFilters).toHaveBeenLastCalledWith([
      expect.objectContaining({ operator: '=|', values: ['dev'], valueLabels: ['dev'] }),
    ]);

    // the value control is now a multi select holding the previous value
    const values = screen.getByLabelText('Default filter 1 values');
    expect(values).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();

    await user.click(values);
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    expect(updateFilters).toHaveBeenLastCalledWith([
      expect.objectContaining({ operator: '=|', values: ['dev', 'prod'], value: 'dev' }),
    ]);
  });

  it('should drop values that no longer match a single value operator', async () => {
    const { user, updateFilters } = setup([
      { key: 'host', operator: '=|', value: 'dev', values: ['dev', 'prod'], valueLabels: ['dev', 'prod'] },
    ]);

    await user.click(screen.getByLabelText('Default filter 1 operator'));
    await user.click(await screen.findByRole('option', { name: '!=' }));

    expect(updateFilters).toHaveBeenLastCalledWith([
      expect.objectContaining({ operator: '!=', value: 'dev', valueLabels: ['dev'] }),
    ]);
    expect(updateFilters.mock.lastCall[0][0].values).toBeUndefined();
  });

  it('should remove a row', async () => {
    const { user, updateFilters } = setup([
      { key: 'host', operator: '=', value: 'dev', origin: 'dashboard' },
      { key: 'cpu_usage', operator: '=', value: 'prod', origin: 'dashboard' },
    ]);

    await user.click(screen.getByLabelText('Remove default filter 1'));

    expect(getRows()).toHaveLength(1);
    expect(updateFilters).toHaveBeenLastCalledWith([expect.objectContaining({ key: 'cpu_usage' })]);
  });

  it('should disable the value control until a key is picked', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('default-filters-add-button'));

    expect(screen.getByLabelText('Default filter 1 value')).toBeDisabled();
  });
});

describe('toComboboxOptions', () => {
  it('should omit the description key when there is no description', () => {
    // Combobox picks the taller dropdown row whenever the key exists, even when it holds undefined
    const [option] = toComboboxOptions([{ label: 'host', value: 'host' }]);

    expect(option).toEqual({ label: 'host', value: 'host' });
    expect('description' in option).toBe(false);
  });

  it('should keep descriptions and fall back to the value as label', () => {
    expect(toComboboxOptions([{ value: '=|', description: 'One of' }])).toEqual([
      { label: '=|', value: '=|', description: 'One of' },
    ]);
  });

  it('should skip options without a value', () => {
    expect(toComboboxOptions([{ label: 'no value' }, { value: 'host' }])).toEqual([{ label: 'host', value: 'host' }]);
  });
});
