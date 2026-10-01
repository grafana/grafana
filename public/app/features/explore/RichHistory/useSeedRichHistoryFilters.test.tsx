import { renderHook } from '@testing-library/react';

import { SortOrder } from 'app/core/utils/richHistoryTypes';

import { useSeedRichHistoryFilters } from './useSeedRichHistoryFilters';

const baseSettings = {
  retentionPeriod: 7,
  starredTabAsFirstTab: false,
  activeDatasourcesOnly: false,
  lastUsedDatasourceFilters: undefined as string[] | undefined,
};

function run(overrides: Partial<Parameters<typeof useSeedRichHistoryFilters>[0]> = {}) {
  const updateFilters = jest.fn();
  renderHook(() =>
    useSeedRichHistoryFilters({
      starred: false,
      isLoadingDatasources: false,
      dsListError: false,
      activeDatasources: ['active-ds'],
      richHistorySettings: baseSettings,
      updateFilters,
      ...overrides,
    })
  );
  return updateFilters;
}

describe('useSeedRichHistoryFilters', () => {
  it('does not seed while datasources are loading', () => {
    const updateFilters = run({ isLoadingDatasources: true });
    expect(updateFilters).not.toHaveBeenCalled();
  });

  it('seeds last-used filters when active-only is off and they exist', () => {
    const updateFilters = run({
      richHistorySettings: { ...baseSettings, lastUsedDatasourceFilters: ['prometheus'] },
    });
    expect(updateFilters).toHaveBeenCalledWith(
      expect.objectContaining({ datasourceFilters: ['prometheus'], starred: false, sortOrder: SortOrder.Descending })
    );
  });

  it('seeds active datasources when active-only is off and no last-used filters', () => {
    const updateFilters = run();
    expect(updateFilters).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: ['active-ds'] }));
  });

  it('seeds active datasources (ignoring last-used) when active-only is on', () => {
    const updateFilters = run({
      richHistorySettings: {
        ...baseSettings,
        activeDatasourcesOnly: true,
        lastUsedDatasourceFilters: ['prometheus'],
      },
    });
    expect(updateFilters).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: ['active-ds'] }));
  });

  it('passes the starred flag through', () => {
    const updateFilters = run({ starred: true });
    expect(updateFilters).toHaveBeenCalledWith(expect.objectContaining({ starred: true }));
  });

  it('does not seed when the datasource list failed and active-only is on', () => {
    const updateFilters = run({
      dsListError: true,
      richHistorySettings: { ...baseSettings, activeDatasourcesOnly: true },
    });
    expect(updateFilters).not.toHaveBeenCalled();
  });

  it('still seeds when the datasource list failed but active-only is off', () => {
    const updateFilters = run({ dsListError: true, activeDatasources: [] });
    expect(updateFilters).toHaveBeenCalledWith(expect.objectContaining({ datasourceFilters: [] }));
  });
});
