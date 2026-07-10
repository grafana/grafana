import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setTemplateSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, type AdHocFilterWithLabels } from '@grafana/scenes';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';

import { PinnedAdHocFilters } from './PinnedAdHocFilters';
import { PinnedAwareFiltersController } from './PinnedAwareFiltersController';
import { createMatchAllFilter } from './pinnedFilters';

mockBoundingClientRect();

beforeAll(() => {
  setTemplateSrv(initTemplateSrv('key', []));
});

function buildVariable(originFilters: AdHocFilterWithLabels[], filters: AdHocFilterWithLabels[] = []) {
  const variable = new AdHocFiltersVariable({
    name: 'Filters',
    supportsMultiValueOperators: true,
    originFilters,
    filters,
  });

  jest.spyOn(variable, '_getValuesFor').mockResolvedValue([
    { label: 'EMEA', value: 'emea' },
    { label: 'AMER', value: 'amer' },
  ]);
  jest.spyOn(variable, '_getKeys').mockResolvedValue([
    { label: 'region', value: 'region' },
    { label: 'cluster', value: 'cluster' },
    { label: 'pod', value: 'pod' },
  ]);

  return variable;
}

describe('PinnedAdHocFilters', () => {
  it('renders one standalone control per pinned filter using its label', () => {
    const variable = buildVariable([
      createMatchAllFilter('territory_location_l1', 'Loc L1'),
      createMatchAllFilter('region'),
    ]);

    render(<PinnedAdHocFilters variable={variable} />);

    expect(screen.getByTestId('pinned-filter-territory_location_l1')).toBeInTheDocument();
    expect(screen.getByText('Loc L1')).toBeInTheDocument();
    expect(screen.getByTestId('pinned-filter-region')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
  });

  it('does not render pinned filters as pills in the bulk combobox', () => {
    const variable = buildVariable(
      [
        createMatchAllFilter('region', 'Region'),
        { key: 'env', operator: '=', value: 'prod', values: ['prod'], origin: 'scope' },
      ],
      [{ key: 'cluster', operator: '=', value: 'prod-1' }]
    );

    render(<PinnedAdHocFilters variable={variable} />);

    // The pinned filter renders as a standalone control, not as a pill
    expect(screen.queryByLabelText('Edit filter with key Region')).not.toBeInTheDocument();
    // Scope-origin filters and user filters keep rendering as pills
    expect(screen.getByLabelText('Edit filter with key env')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit filter with key cluster')).toBeInTheDocument();
  });

  it('shows the current pinned selection in the control', () => {
    const variable = buildVariable([
      {
        key: 'region',
        keyLabel: 'Region',
        operator: '=|',
        value: 'emea',
        values: ['emea', 'amer'],
        valueLabels: ['EMEA', 'AMER'],
        origin: 'dashboard',
      },
    ]);

    render(<PinnedAdHocFilters variable={variable} />);

    expect(screen.getByText('EMEA')).toBeInTheDocument();
    // Depending on the measured width the second value renders as a pill or an overflow ("...1") chip
    const control = screen.getByTestId('pinned-filter-region');
    expect(control.textContent).toMatch(/AMER|1/);
  });

  it('commits a value selected in the pinned control to the variable', async () => {
    const variable = buildVariable([createMatchAllFilter('region', 'Region')]);

    render(<PinnedAdHocFilters variable={variable} />);

    await userEvent.click(screen.getByTestId('pinned-filter-value-region'));
    await userEvent.click(await screen.findByRole('option', { name: /EMEA/ }));

    await waitFor(() => {
      expect(variable.state.originFilters![0]).toMatchObject({
        key: 'region',
        operator: '=|',
        values: ['emea'],
        valueLabels: ['EMEA'],
        origin: 'dashboard',
      });
    });
  });

  it('shows a restore button when the pinned filter was changed from its default', async () => {
    const variable = buildVariable([createMatchAllFilter('region', 'Region')]);

    render(<PinnedAdHocFilters variable={variable} />);

    expect(
      screen.queryByRole('button', { name: 'Restore Region to the value set by this dashboard' })
    ).not.toBeInTheDocument();

    act(() => {
      variable._updateFilter(variable.state.originFilters![0], {
        operator: '=|',
        value: 'emea',
        values: ['emea'],
        valueLabels: ['EMEA'],
      });
    });

    const restoreButton = await screen.findByRole('button', {
      name: 'Restore Region to the value set by this dashboard',
    });

    await userEvent.click(restoreButton);

    await waitFor(() => {
      expect(variable.state.originFilters![0]).toMatchObject({ operator: '=~', value: '.*', restorable: false });
    });
  });
});

describe('PinnedAwareFiltersController', () => {
  it('strips pinned keys from key suggestions', async () => {
    const variable = buildVariable([createMatchAllFilter('region', 'Region')]);
    const controller = new PinnedAwareFiltersController(variable);

    const keys = await controller.getKeys(null);

    expect(keys.map((k) => k.value)).toEqual(['cluster', 'pod']);
  });
});
