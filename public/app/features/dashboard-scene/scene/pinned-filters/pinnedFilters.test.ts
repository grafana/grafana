import { setTemplateSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type AdHocFilterWithLabels } from '@grafana/scenes';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';

import {
  createMatchAllFilter,
  getPinnedFilters,
  getPinnedFilterSelectedValues,
  isMatchAllFilter,
  isPinnedFilter,
  splitAdHocVariableFilters,
} from './pinnedFilters';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

const mockGetFeatureFlagClient = jest.mocked(getFeatureFlagClient);
const getBooleanValueFn = jest.fn();

function stubPinnedFiltersEnabled(enabled: boolean) {
  getBooleanValueFn.mockImplementation((key: string, defaultValue: boolean) =>
    key === FlagKeys.GrafanaPinnedFilters ? enabled : defaultValue
  );
}

beforeAll(() => {
  setTemplateSrv(initTemplateSrv('key', []));
  mockGetFeatureFlagClient.mockReturnValue({
    getBooleanValue: getBooleanValueFn,
  } as unknown as ReturnType<typeof getFeatureFlagClient>);
});

beforeEach(() => {
  stubPinnedFiltersEnabled(false);
});

describe('pinnedFilters utils', () => {
  describe('isPinnedFilter', () => {
    it('is true for dashboard-origin non-groupBy filters', () => {
      expect(isPinnedFilter({ key: 'a', operator: '=', value: 'b', origin: 'dashboard' })).toBe(true);
    });

    it('is false for scope-origin, groupBy and regular filters', () => {
      expect(isPinnedFilter({ key: 'a', operator: '=', value: 'b', origin: 'scope' })).toBe(false);
      expect(isPinnedFilter({ key: 'a', operator: 'groupBy', value: '', origin: 'dashboard' })).toBe(false);
      expect(isPinnedFilter({ key: 'a', operator: '=', value: 'b' })).toBe(false);
    });
  });

  describe('createMatchAllFilter', () => {
    it('creates a complete dashboard-origin match-all filter', () => {
      const filter = createMatchAllFilter('region', 'Region');

      expect(filter).toEqual({
        key: 'region',
        keyLabel: 'Region',
        operator: '=~',
        value: '.*',
        values: ['.*'],
        valueLabels: ['All'],
        matchAllFilter: true,
        origin: 'dashboard',
      });
      expect(isMatchAllFilter(filter)).toBe(true);
      expect(isPinnedFilter(filter)).toBe(true);
    });

    it('falls back to the key as label', () => {
      expect(createMatchAllFilter('region').keyLabel).toBe('region');
    });
  });

  describe('getPinnedFilterSelectedValues', () => {
    it('returns empty selection for match-all filters', () => {
      expect(getPinnedFilterSelectedValues(createMatchAllFilter('region'))).toEqual([]);
    });

    it('pairs values with their labels', () => {
      const filter: AdHocFilterWithLabels = {
        key: 'region',
        operator: '=|',
        value: 'a',
        values: ['a', 'b'],
        valueLabels: ['A', 'B'],
        origin: 'dashboard',
      };

      expect(getPinnedFilterSelectedValues(filter)).toEqual([
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]);
    });

    it('falls back to single value when values is unset', () => {
      const filter: AdHocFilterWithLabels = { key: 'region', operator: '=', value: 'a', origin: 'dashboard' };

      expect(getPinnedFilterSelectedValues(filter)).toEqual([{ value: 'a', label: 'a' }]);
    });
  });

  describe('getPinnedFilters', () => {
    it('returns only dashboard-origin non-groupBy filters', () => {
      const filters: AdHocFilterWithLabels[] = [
        createMatchAllFilter('region'),
        { key: 'env', operator: '=', value: 'prod', origin: 'scope' },
        { key: 'cluster', operator: 'groupBy', value: '', origin: 'dashboard' },
        { key: 'plain', operator: '=', value: 'x' },
      ];

      expect(getPinnedFilters(filters).map((f) => f.key)).toEqual(['region']);
      expect(getPinnedFilters(undefined)).toEqual([]);
    });
  });

  describe('splitAdHocVariableFilters', () => {
    it('keeps pinned origin filters when the feature is enabled', () => {
      stubPinnedFiltersEnabled(true);

      const result = splitAdHocVariableFilters([
        { key: 'slice', operator: '=~', value: '.*', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);

      expect(result.originFilters).toEqual([{ key: 'slice', operator: '=~', value: '.*', origin: 'dashboard' }]);
      expect(result.filters).toEqual([{ key: 'env', operator: '=', value: 'prod' }]);
    });

    it('flattens pinned origin filters into runtime filters when the feature is disabled', () => {
      stubPinnedFiltersEnabled(false);

      const result = splitAdHocVariableFilters([
        { key: 'slice', operator: '=~', value: '.*', origin: 'dashboard' },
        { key: 'cluster', operator: 'groupBy', value: '', origin: 'dashboard' },
        { key: 'env', operator: '=', value: 'prod' },
      ]);

      expect(result.originFilters).toEqual([
        { key: 'cluster', operator: 'groupBy', value: '', origin: 'dashboard' },
      ]);
      expect(result.filters).toEqual([
        { key: 'env', operator: '=', value: 'prod' },
        { key: 'slice', operator: '=~', value: '.*' },
      ]);
    });
  });
});
