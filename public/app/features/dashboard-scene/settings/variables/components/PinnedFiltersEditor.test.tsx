import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdHocFilterWithLabels } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { createMatchAllFilter } from '../../../scene/pinned-filters/pinnedFilters';

import { PinnedFiltersEditor, type PinnedFiltersEditorProps } from './PinnedFiltersEditor';

mockBoundingClientRect();

function setup(props: Partial<PinnedFiltersEditorProps> = {}) {
  const onChange = jest.fn();
  const getKeyOptions = jest.fn().mockResolvedValue([
    { label: 'region', value: 'region' },
    { label: 'territory_location_l1', value: 'territory_location_l1' },
    { label: 'cluster', value: 'cluster' },
  ]);
  const getValueOptions = jest.fn().mockResolvedValue([
    { label: 'emea', value: 'emea' },
    { label: 'amer', value: 'amer' },
  ]);

  const utils = render(
    <PinnedFiltersEditor
      filters={[]}
      onChange={onChange}
      getKeyOptions={getKeyOptions}
      getValueOptions={getValueOptions}
      supportsMultiValueOperators
      {...props}
    />
  );

  return { onChange, getKeyOptions, getValueOptions, ...utils };
}

describe('PinnedFiltersEditor', () => {
  it('adds a pinned filter without default values as match-all', async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByTestId('pinned-filters-editor-add'));
    await userEvent.click(screen.getByTestId('pinned-filters-editor-key-new'));
    await userEvent.click(await screen.findByRole('option', { name: 'region' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        operator: '=~',
        value: '.*',
        origin: 'dashboard',
      }),
    ]);
  });

  it('excludes already-pinned keys from the field options', async () => {
    setup({ filters: [createMatchAllFilter('region', 'Region')] });

    await userEvent.click(screen.getByTestId('pinned-filters-editor-add'));
    await userEvent.click(screen.getByTestId('pinned-filters-editor-key-new'));

    expect(await screen.findByRole('option', { name: 'cluster' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'region' })).not.toBeInTheDocument();
  });

  it('updates the custom label on blur', async () => {
    const { onChange } = setup({ filters: [createMatchAllFilter('territory_location_l1')] });

    const labelInput = screen.getByRole('textbox', { name: 'Pinned filter label' });
    await userEvent.type(labelInput, 'Loc L1');
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'territory_location_l1', keyLabel: 'Loc L1' }),
    ]);
  });

  it('commits default values with the multi-value operator', async () => {
    const { onChange } = setup({ filters: [createMatchAllFilter('region', 'Region')] });

    await userEvent.click(screen.getByTestId('pinned-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'emea' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'region',
        keyLabel: 'Region',
        operator: '=|',
        value: 'emea',
        values: ['emea'],
        origin: 'dashboard',
      }),
    ]);
  });

  it('returns to match-all when default values are cleared', async () => {
    const pinnedWithDefaults: AdHocFilterWithLabels = {
      key: 'region',
      keyLabel: 'Region',
      operator: '=|',
      value: 'emea',
      values: ['emea'],
      valueLabels: ['emea'],
      origin: 'dashboard',
    };
    const { onChange } = setup({ filters: [pinnedWithDefaults] });

    await userEvent.click(screen.getByTestId('pinned-filters-editor-values-region'));
    // Deselect the only selected option
    await userEvent.click(await screen.findByRole('option', { name: 'emea' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'region', keyLabel: 'Region', operator: '=~', value: '.*' }),
    ]);
  });

  it('removes a pinned filter', async () => {
    const { onChange } = setup({
      filters: [createMatchAllFilter('region', 'Region'), createMatchAllFilter('cluster')],
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Remove pinned filter' });
    await userEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'cluster' })]);
  });

  it('uses the = operator when multi-value operators are unsupported', async () => {
    const { onChange } = setup({
      filters: [createMatchAllFilter('region', 'Region')],
      supportsMultiValueOperators: false,
    });

    await userEvent.click(screen.getByTestId('pinned-filters-editor-values-region'));
    await userEvent.click(await screen.findByRole('option', { name: 'emea' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ operator: '=', value: 'emea' })]);
  });
});
