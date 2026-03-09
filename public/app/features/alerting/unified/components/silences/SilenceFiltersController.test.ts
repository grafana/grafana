import { Silence } from 'app/plugins/datasource/alertmanager/types';

import { SilenceFiltersController } from './SilencesFilter';

describe('SilenceFiltersController', () => {
  it('clearAll resets wip state', () => {
    const silencesRef = { current: [] as Silence[] };
    const filters = [{ key: 'foo', operator: '=', value: 'bar' }];
    let capturedFilters: unknown[] = [];
    let capturedWip: unknown = undefined;

    const setFilters = (f: unknown[]) => {
      capturedFilters = f;
    };
    const updateQueryString = jest.fn();
    const wip = { key: 'severity', operator: '=', value: '' };
    const setWip = (w: unknown) => {
      capturedWip = w;
    };

    const controller = new SilenceFiltersController(silencesRef, filters, setFilters, updateQueryString, wip, setWip);

    controller.clearAll();

    expect(capturedFilters).toEqual([]);
    expect(capturedWip).toEqual({ key: '', operator: '=', value: '' });
    expect(updateQueryString).toHaveBeenCalledWith([]);
  });
});
