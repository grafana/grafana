import { setTemplateSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, type AdHocFilterWithLabels } from '@grafana/scenes';

import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';

import {
  commitPinnedFilterValues,
  createMatchAllFilter,
  getPinnedFilters,
  getPinnedFilterSelectedValues,
  isMatchAllFilter,
  isPinnedFilter,
} from './pinnedFilters';

beforeAll(() => {
  setTemplateSrv(initTemplateSrv('key', []));
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

  describe('commitPinnedFilterValues', () => {
    function buildVariable(originFilters: AdHocFilterWithLabels[], supportsMultiValueOperators = true) {
      return new AdHocFiltersVariable({
        name: 'Filters',
        supportsMultiValueOperators,
        originFilters,
        filters: [],
      });
    }

    it('commits a multi-value selection with the =| operator', () => {
      const variable = buildVariable([createMatchAllFilter('region', 'Region')]);

      commitPinnedFilterValues(variable, variable.state.originFilters![0], [
        { value: 'emea', label: 'EMEA' },
        { value: 'amer', label: 'AMER' },
      ]);

      expect(variable.state.originFilters![0]).toMatchObject({
        key: 'region',
        operator: '=|',
        value: 'emea',
        values: ['emea', 'amer'],
        valueLabels: ['EMEA', 'AMER'],
        origin: 'dashboard',
      });
    });

    it('commits with = when multi-value operators are unsupported', () => {
      const variable = buildVariable([createMatchAllFilter('region')], false);

      commitPinnedFilterValues(variable, variable.state.originFilters![0], [{ value: 'emea', label: 'EMEA' }]);

      expect(variable.state.originFilters![0]).toMatchObject({ operator: '=', value: 'emea' });
    });

    it('restores the original match-all filter when the selection is cleared', () => {
      const variable = buildVariable([createMatchAllFilter('region', 'Region')]);

      commitPinnedFilterValues(variable, variable.state.originFilters![0], [{ value: 'emea', label: 'EMEA' }]);
      expect(variable.state.originFilters![0].restorable).toBe(true);

      commitPinnedFilterValues(variable, variable.state.originFilters![0], []);

      const restored = variable.state.originFilters![0];
      expect(isMatchAllFilter(restored)).toBe(true);
      expect(restored.restorable).toBe(false);
    });

    it('converts to match-all (restorable) when clearing a filter with author defaults', () => {
      const variable = buildVariable([
        {
          key: 'region',
          keyLabel: 'Region',
          operator: '=|',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['EMEA'],
          origin: 'dashboard',
        },
      ]);

      commitPinnedFilterValues(variable, variable.state.originFilters![0], []);

      const updated = variable.state.originFilters![0];
      expect(isMatchAllFilter(updated)).toBe(true);
      expect(updated.restorable).toBe(true);
    });

    it('is a no-op when the selection is unchanged', () => {
      const variable = buildVariable([
        {
          key: 'region',
          operator: '=|',
          value: 'emea',
          values: ['emea'],
          valueLabels: ['EMEA'],
          origin: 'dashboard',
        },
      ]);

      const before = variable.state.originFilters;
      commitPinnedFilterValues(variable, variable.state.originFilters![0], [{ value: 'emea', label: 'EMEA' }]);

      expect(variable.state.originFilters).toBe(before);
    });

    it('is a no-op when clearing an already match-all filter', () => {
      const variable = buildVariable([createMatchAllFilter('region')]);

      const before = variable.state.originFilters;
      commitPinnedFilterValues(variable, variable.state.originFilters![0], []);

      expect(variable.state.originFilters).toBe(before);
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
});
