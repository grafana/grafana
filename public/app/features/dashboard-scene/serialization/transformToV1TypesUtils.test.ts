import { SpecialValueMatch as SpecialValueMatchV1 } from '@grafana/data';
import {
  VariableHide as VariableHideV1,
  VariableRefresh as VariableRefreshV1,
  VariableSort as VariableSortV1,
  DashboardCursorSync as DashboardCursorSyncV1,
  defaultDashboardCursorSync,
  MappingType as MappingTypeV1,
  ThresholdsMode as ThresholdsModeV1,
} from '@grafana/schema';
import {
  DashboardCursorSync,
  VariableHide,
  VariableRefresh,
  VariableSort,
  FieldConfigSource,
  SpecialValueMatch,
  ThresholdsMode,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import {
  transformVariableRefreshToEnumV1,
  transformVariableHideToEnumV1,
  transformSortVariableToEnumV1,
  transformCursorSyncV2ToV1,
  transformMappingsAndActionsToV1,
} from './transformToV1TypesUtils';

describe('transformToV1TypesUtils', () => {
  describe('transformVariableRefreshToEnumV1', () => {
    it('should transform "never" to VariableRefreshV1.never', () => {
      expect(transformVariableRefreshToEnumV1('never')).toBe(VariableRefreshV1.never);
    });

    it('should transform "onDashboardLoad" to VariableRefreshV1.onDashboardLoad', () => {
      expect(transformVariableRefreshToEnumV1('onDashboardLoad')).toBe(VariableRefreshV1.onDashboardLoad);
    });

    it('should transform "onTimeRangeChanged" to VariableRefreshV1.onTimeRangeChanged', () => {
      expect(transformVariableRefreshToEnumV1('onTimeRangeChanged')).toBe(VariableRefreshV1.onTimeRangeChanged);
    });

    it('should return VariableRefreshV1.never for undefined', () => {
      expect(transformVariableRefreshToEnumV1(undefined)).toBe(VariableRefreshV1.never);
    });

    it('should return VariableRefreshV1.never for unknown values', () => {
      expect(transformVariableRefreshToEnumV1('unknown' as VariableRefresh)).toBe(VariableRefreshV1.never);
    });
  });

  describe('transformVariableHideToEnumV1', () => {
    it('should transform "dontHide" to VariableHideV1.dontHide', () => {
      expect(transformVariableHideToEnumV1('dontHide')).toBe(VariableHideV1.dontHide);
    });

    it('should transform "hideLabel" to VariableHideV1.hideLabel', () => {
      expect(transformVariableHideToEnumV1('hideLabel')).toBe(VariableHideV1.hideLabel);
    });

    it('should transform "hideVariable" to VariableHideV1.hideVariable', () => {
      expect(transformVariableHideToEnumV1('hideVariable')).toBe(VariableHideV1.hideVariable);
    });

    it('should return VariableHideV1.dontHide for undefined', () => {
      expect(transformVariableHideToEnumV1(undefined)).toBe(VariableHideV1.dontHide);
    });

    it('should return VariableHideV1.dontHide for unknown values', () => {
      expect(transformVariableHideToEnumV1('unknown' as VariableHide)).toBe(VariableHideV1.dontHide);
    });
  });

  describe('transformSortVariableToEnumV1', () => {
    it('should transform "disabled" to VariableSortV1.disabled', () => {
      expect(transformSortVariableToEnumV1('disabled')).toBe(VariableSortV1.disabled);
    });

    it('should transform "numericalAsc" to VariableSortV1.numericalAsc', () => {
      expect(transformSortVariableToEnumV1('numericalAsc')).toBe(VariableSortV1.numericalAsc);
    });

    it('should transform "alphabeticalCaseInsensitiveAsc" to VariableSortV1.alphabeticalCaseInsensitiveAsc', () => {
      expect(transformSortVariableToEnumV1('alphabeticalCaseInsensitiveAsc')).toBe(
        VariableSortV1.alphabeticalCaseInsensitiveAsc
      );
    });

    it('should transform "alphabeticalCaseInsensitiveDesc" to VariableSortV1.alphabeticalCaseInsensitiveDesc', () => {
      expect(transformSortVariableToEnumV1('alphabeticalCaseInsensitiveDesc')).toBe(
        VariableSortV1.alphabeticalCaseInsensitiveDesc
      );
    });

    it('should transform "numericalDesc" to VariableSortV1.numericalDesc', () => {
      expect(transformSortVariableToEnumV1('numericalDesc')).toBe(VariableSortV1.numericalDesc);
    });

    it('should transform "naturalAsc" to VariableSortV1.naturalAsc', () => {
      expect(transformSortVariableToEnumV1('naturalAsc')).toBe(VariableSortV1.naturalAsc);
    });

    it('should transform "naturalDesc" to VariableSortV1.naturalDesc', () => {
      expect(transformSortVariableToEnumV1('naturalDesc')).toBe(VariableSortV1.naturalDesc);
    });

    it('should transform "alphabeticalAsc" to VariableSortV1.alphabeticalAsc', () => {
      expect(transformSortVariableToEnumV1('alphabeticalAsc')).toBe(VariableSortV1.alphabeticalAsc);
    });

    it('should transform "alphabeticalDesc" to VariableSortV1.alphabeticalDesc', () => {
      expect(transformSortVariableToEnumV1('alphabeticalDesc')).toBe(VariableSortV1.alphabeticalDesc);
    });

    it('should return VariableSortV1.disabled for undefined', () => {
      expect(transformSortVariableToEnumV1(undefined)).toBe(VariableSortV1.disabled);
    });

    it('should return VariableSortV1.disabled for unknown values', () => {
      expect(transformSortVariableToEnumV1('unknown' as VariableSort)).toBe(VariableSortV1.disabled);
    });
  });

  describe('transformCursorSyncV2ToV1', () => {
    it('should transform "Crosshair" to DashboardCursorSyncV1.Crosshair', () => {
      expect(transformCursorSyncV2ToV1('Crosshair')).toBe(DashboardCursorSyncV1.Crosshair);
    });

    it('should transform "Tooltip" to DashboardCursorSyncV1.Tooltip', () => {
      expect(transformCursorSyncV2ToV1('Tooltip')).toBe(DashboardCursorSyncV1.Tooltip);
    });

    it('should transform "Off" to DashboardCursorSyncV1.Off', () => {
      expect(transformCursorSyncV2ToV1('Off')).toBe(DashboardCursorSyncV1.Off);
    });

    it('should return defaultDashboardCursorSync for unknown values', () => {
      expect(transformCursorSyncV2ToV1('unknown' as DashboardCursorSync)).toBe(defaultDashboardCursorSync);
    });
  });

  describe('transformMappingsAndActionsToV1', () => {
    it('should transform field config without mappings or actions', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          displayName: 'Test Field',
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result).toEqual({
        defaults: {
          displayName: 'Test Field',
        },
        overrides: [],
      });
    });

    it('should transform value mappings', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          mappings: [
            {
              type: 'value',
              options: {
                '1': {
                  text: 'One',
                },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.mappings).toEqual([
        {
          type: MappingTypeV1.ValueToText,
          options: {
            '1': {
              text: 'One',
            },
          },
        },
      ]);
    });

    it('should transform range mappings', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          mappings: [
            {
              type: 'range',
              options: {
                from: 0,
                to: 10,
                result: {
                  text: 'Low',
                },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.mappings).toEqual([
        {
          type: MappingTypeV1.RangeToText,
          options: {
            from: 0,
            to: 10,
            result: {
              text: 'Low',
            },
          },
        },
      ]);
    });

    it('should transform regex mappings', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          mappings: [
            {
              type: 'regex',
              options: {
                pattern: '/test.*/',
                result: {
                  text: 'Matched',
                },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.mappings).toEqual([
        {
          type: MappingTypeV1.RegexToText,
          options: {
            pattern: '/test.*/',
            result: {
              text: 'Matched',
            },
          },
        },
      ]);
    });

    it('should transform special value mappings', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          mappings: [
            {
              type: 'special',
              options: {
                match: 'null' as SpecialValueMatch,
                result: {
                  text: 'No data',
                },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.mappings).toEqual([
        {
          type: MappingTypeV1.SpecialValue,
          options: {
            match: SpecialValueMatchV1.Null,
            result: {
              text: 'No data',
            },
          },
        },
      ]);
    });

    it('should transform all special value match types', () => {
      const specialValues: Array<{ match: SpecialValueMatch; expected: SpecialValueMatchV1 }> = [
        { match: 'true', expected: SpecialValueMatchV1.True },
        { match: 'false', expected: SpecialValueMatchV1.False },
        { match: 'null', expected: SpecialValueMatchV1.Null },
        { match: 'nan', expected: SpecialValueMatchV1.NaN },
        { match: 'null+nan', expected: SpecialValueMatchV1.NullAndNaN },
        { match: 'empty', expected: SpecialValueMatchV1.Empty },
      ];

      specialValues.forEach(({ match, expected }) => {
        const fieldConfig: FieldConfigSource = {
          defaults: {
            mappings: [
              {
                type: 'special',
                options: {
                  match,
                  result: { text: 'Test' },
                },
              },
            ],
          },
          overrides: [],
        };

        const result = transformMappingsAndActionsToV1(fieldConfig);
        // @ts-expect-error
        expect(result.defaults.mappings?.[0].options.match).toBe(expected);
      });
    });

    it('should transform thresholds mode', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          thresholds: {
            mode: 'percentage' as ThresholdsMode,
            steps: [
              { color: 'green', value: 0 },
              { color: 'red', value: 80 },
            ],
          },
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.thresholds).toEqual({
        mode: ThresholdsModeV1.Percentage,
        steps: [
          { color: 'green', value: 0 },
          { color: 'red', value: 80 },
        ],
      });
    });

    it('should transform absolute thresholds mode', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          thresholds: {
            mode: 'absolute' as ThresholdsMode,
            steps: [{ color: 'green', value: 0 }],
          },
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.thresholds?.mode).toBe(ThresholdsModeV1.Absolute);
    });

    it('should transform fetch actions with headers and query params', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          actions: [
            {
              type: 'fetch',
              title: 'Fetch Action',
              fetch: {
                method: 'GET',
                url: 'https://example.com',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
                queryParams: { param1: 'value1', param2: 'value2' },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.actions).toEqual([
        {
          title: 'Fetch Action',
          type: 'fetch',
          fetch: {
            method: 'GET',
            url: 'https://example.com',
            headers: [
              ['Content-Type', 'application/json'],
              ['Authorization', 'Bearer token'],
            ],
            queryParams: [
              ['param1', 'value1'],
              ['param2', 'value2'],
            ],
          },
        },
      ]);
    });

    it('should transform infinity actions with headers and query params', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          actions: [
            {
              type: 'infinity',
              title: 'Infinity Action',
              infinity: {
                method: 'GET',
                datasourceUid: 'infinity-ds-uid',
                url: 'https://example.com',
                headers: { 'X-Custom': 'value' },
                queryParams: { search: 'test' },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.actions).toEqual([
        {
          title: 'Infinity Action',
          type: 'infinity',
          infinity: {
            method: 'GET',
            datasourceUid: 'infinity-ds-uid',
            url: 'https://example.com',
            headers: [['X-Custom', 'value']],
            queryParams: [['search', 'test']],
          },
        },
      ]);
    });

    it('should filter out empty headers and query params', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          actions: [
            {
              type: 'fetch',
              title: 'Fetch Action',
              fetch: {
                method: 'GET',
                url: 'https://example.com',
                headers: { 'Content-Type': 'application/json' },
                queryParams: { param1: 'value1' },
              },
            },
          ],
        },
        overrides: [],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.actions).toEqual([
        {
          title: 'Fetch Action',
          type: 'fetch',
          fetch: {
            method: 'GET',
            url: 'https://example.com',
            headers: [['Content-Type', 'application/json']],
            queryParams: [['param1', 'value1']],
          },
        },
      ]);
    });

    it('should handle complex field config with all features', () => {
      const fieldConfig: FieldConfigSource = {
        defaults: {
          displayName: 'Complex Field',
          mappings: [
            { type: 'value', options: { '1': { text: 'One' } } },
            { type: 'special', options: { match: 'null' as SpecialValueMatch, result: { text: 'No data' } } },
          ],
          thresholds: {
            mode: 'percentage' as ThresholdsMode,
            steps: [{ color: 'green', value: 0 }],
          },
          actions: [
            {
              type: 'fetch',
              title: 'Fetch Action',
              fetch: {
                method: 'POST',
                url: 'https://api.example.com',
                headers: { Authorization: 'Bearer token' },
              },
            },
          ],
        },
        overrides: [
          {
            matcher: { id: 'byName', options: 'test' },
            properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
          },
        ],
      };

      const result = transformMappingsAndActionsToV1(fieldConfig);

      expect(result.defaults.mappings).toHaveLength(2);
      expect(result.defaults.mappings?.[0].type).toBe(MappingTypeV1.ValueToText);
      expect(result.defaults.mappings?.[1].type).toBe(MappingTypeV1.SpecialValue);
      expect(result.defaults.thresholds?.mode).toBe(ThresholdsModeV1.Percentage);
      expect(result.defaults.actions?.[0].fetch?.headers).toEqual([['Authorization', 'Bearer token']]);
      expect(result.overrides).toHaveLength(1);
    });
  });
});
