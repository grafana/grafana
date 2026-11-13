import { waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { AdHocFiltersVariable } from '@grafana/scenes';

import { resolveMultiValueOperatorsOnActivate } from './resolveMultiValueOperatorsOnActivate';

const templateSrv = { getAdhocFilters: jest.fn() };

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
  getTemplateSrv: () => templateSrv,
}));

function mockSupport(supports: boolean) {
  jest
    .mocked(getDataSourceInstanceSettings)
    .mockResolvedValue({ meta: { multiValueFilterOperators: supports } } as unknown as DataSourceInstanceSettings);
}

function buildVariable(supportsMultiValueOperators: boolean) {
  return new AdHocFiltersVariable({
    name: 'filters',
    datasource: { uid: 'ds-uid', type: 'ds-type' },
    supportsMultiValueOperators,
    $behaviors: [resolveMultiValueOperatorsOnActivate],
  });
}

describe('resolveMultiValueOperatorsOnActivate', () => {
  it('does not look up support before the variable activates', () => {
    mockSupport(true);

    buildVariable(false);

    expect(getDataSourceInstanceSettings).not.toHaveBeenCalled();
  });

  it('sets the flag when the data source supports multi-value operators', async () => {
    mockSupport(true);
    const variable = buildVariable(false);

    variable.activate();

    expect(getDataSourceInstanceSettings).toHaveBeenCalledWith({ type: 'ds-type' });
    await waitFor(() => expect(variable.state.supportsMultiValueOperators).toBe(true));
  });

  it('clears the flag when the data source lacks support', async () => {
    mockSupport(false);
    const variable = buildVariable(true);

    variable.activate();

    await waitFor(() => expect(variable.state.supportsMultiValueOperators).toBe(false));
  });

  // Dashboard swaps install clones of built state before the build's variables ever activate.
  it('sets the flag on a clone once the clone activates', async () => {
    mockSupport(true);
    const original = buildVariable(false);

    const clone = original.clone();
    clone.activate();

    await waitFor(() => expect(clone.state.supportsMultiValueOperators).toBe(true));
    expect(original.state.supportsMultiValueOperators).toBe(false);
  });
});
