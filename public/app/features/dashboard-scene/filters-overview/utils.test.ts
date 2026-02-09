import { SelectableValue } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';

import { buildAdHocApplyFilters, buildGroupByUpdate, buildOverviewState } from './utils';

describe('DashboardFiltersOverview utils', () => {
  describe('buildOverviewState', () => {
    it('builds state from origin and selected filters', () => {
      const originFilters: AdHocFilterWithLabels[] = [
        {
          key: 'region',
          keyLabel: 'Region',
          operator: '=|',
          value: 'us-east-1',
          values: ['us-east-1', 'us-west-1'],
        },
      ];
      const filters: AdHocFilterWithLabels[] = [
        {
          key: 'service',
          keyLabel: 'Service',
          operator: '=',
          value: 'api',
        },
      ];

      const result = buildOverviewState({ originFilters, filters });

      expect(result.keys).toEqual([
        { label: 'Region', value: 'region' },
        { label: 'Service', value: 'service' },
      ]);
      expect(result.isOriginByKey).toEqual({ region: true, service: false });
      expect(result.operatorsByKey).toEqual({ region: '=', service: '=' });
      expect(result.multiValuesByKey).toEqual({});
      expect(result.singleValuesByKey).toEqual({ region: 'us-east-1', service: 'api' });
    });

    it('skips non-applicable filters', () => {
      const originFilters: AdHocFilterWithLabels[] = [
        {
          key: 'region',
          operator: '=',
          value: 'us-east-1',
          nonApplicable: true,
        },
      ];
      const filters: AdHocFilterWithLabels[] = [
        {
          key: 'service',
          operator: '=',
          value: 'api',
          nonApplicable: true,
        },
      ];

      const result = buildOverviewState({ originFilters, filters });

      expect(result.keys).toEqual([]);
      expect(result.isOriginByKey).toEqual({});
    });

    it('clears value for match-all origin filters', () => {
      const originFilters: AdHocFilterWithLabels[] = [
        {
          key: 'region',
          keyLabel: 'Region',
          operator: '=~',
          value: '.*',
          values: ['.*'],
          matchAllFilter: true,
          origin: 'dashboard',
        },
      ];

      const result = buildOverviewState({ originFilters, filters: [] });

      expect(result.operatorsByKey).toEqual({ region: '=' });
      expect(result.singleValuesByKey).toEqual({ region: '' });
    });
  });

  describe('buildGroupByUpdate', () => {
    it('returns group by values and text', () => {
      const keys: Array<SelectableValue<string>> = [
        { value: 'region', label: 'Region' },
        { value: 'service', label: 'Service' },
      ];
      const isGrouped = { region: true, service: false };

      const result = buildGroupByUpdate(keys, isGrouped);

      expect(result.nextValues).toEqual(['region']);
      expect(result.nextText).toEqual(['Region']);
    });
  });

  describe('buildAdHocApplyFilters', () => {
    it('builds next filters and origin filters', () => {
      const keys: Array<SelectableValue<string>> = [
        { value: 'region', label: 'Region' },
        { value: 'service', label: 'Service' },
      ];
      const existingOriginFilters: AdHocFilterWithLabels[] = [
        {
          key: 'region',
          operator: '=',
          value: 'us-east-1',
          origin: 'dashboard',
        },
      ];
      const existingFilters: AdHocFilterWithLabels[] = [
        {
          key: 'service',
          operator: '=',
          value: 'api',
        },
        {
          key: 'env',
          operator: '=',
          value: 'prod',
          nonApplicable: true,
        },
      ];

      const result = buildAdHocApplyFilters({
        keys,
        isOriginByKey: { region: true, service: false },
        operatorsByKey: { region: '=', service: '=' },
        singleValuesByKey: { region: 'us-west-1', service: 'api' },
        multiValuesByKey: {},
        existingOriginFilters,
        existingFilters,
      });

      expect(result.nextOriginFilters).toEqual([
        {
          key: 'region',
          operator: '=',
          value: 'us-west-1',
          origin: 'dashboard',
          keyLabel: 'Region',
          values: undefined,
          valueLabels: undefined,
        },
      ]);
      expect(result.nextFilters).toEqual([
        {
          key: 'service',
          operator: '=',
          value: 'api',
          keyLabel: 'Service',
          values: undefined,
          valueLabels: undefined,
        },
      ]);
      expect(result.nonApplicableFilters).toEqual([
        {
          key: 'env',
          operator: '=',
          value: 'prod',
          nonApplicable: true,
        },
      ]);
    });

    it('skips empty multi-values', () => {
      const keys: Array<SelectableValue<string>> = [{ value: 'region', label: 'Region' }];

      const result = buildAdHocApplyFilters({
        keys,
        isOriginByKey: { region: false },
        operatorsByKey: { region: '=|' },
        singleValuesByKey: {},
        multiValuesByKey: { region: [] },
        existingOriginFilters: [],
        existingFilters: [],
      });

      expect(result.nextFilters).toEqual([]);
    });

    it('keeps origin filters with empty values', () => {
      const keys: Array<SelectableValue<string>> = [{ value: 'region', label: 'Region' }];
      const existingOriginFilters: AdHocFilterWithLabels[] = [
        {
          key: 'region',
          operator: '=',
          value: 'us-east-1',
          origin: 'dashboard',
        },
      ];

      const result = buildAdHocApplyFilters({
        keys,
        isOriginByKey: { region: true },
        operatorsByKey: { region: '=' },
        singleValuesByKey: { region: '' },
        multiValuesByKey: {},
        existingOriginFilters,
        existingFilters: [],
      });

      expect(result.nextOriginFilters).toEqual([
        {
          key: 'region',
          operator: '=',
          value: '',
          origin: 'dashboard',
          keyLabel: 'Region',
          values: undefined,
          valueLabels: undefined,
        },
      ]);
    });
  });
});
