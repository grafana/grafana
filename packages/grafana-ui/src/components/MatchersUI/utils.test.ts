import { renderHook } from '@testing-library/react';

import { type DataFrame, type Field, FieldType, FieldNamePickerBaseNameMode, toDataFrame } from '@grafana/data';
import { type MatcherScope } from '@grafana/schema';

import {
  type FrameFieldsDisplayNames,
  frameHasName,
  getFrameFieldsDisplayNames,
  getGroupDescriptionForScope,
  getGroupLabelForScope,
  getUniqueMatcherScopes,
  useFieldDisplayNames,
  useMatcherSelectOptions,
} from './utils';

describe('MatchersUI utils', () => {
  describe('frameHasName', () => {
    const names: FrameFieldsDisplayNames = {
      display: new Set(['DisplayA', 'DisplayB']),
      raw: new Set(['rawField']),
      fields: new Map(),
      scopes: new Map(),
    };

    it('returns false when name is undefined', () => {
      expect(frameHasName(undefined, names)).toBe(false);
    });

    it('returns false when name is empty string', () => {
      expect(frameHasName('', names)).toBe(false);
    });

    it('returns true when name is in display set', () => {
      expect(frameHasName('DisplayA', names)).toBe(true);
      expect(frameHasName('DisplayB', names)).toBe(true);
    });

    it('returns true when name is in raw set', () => {
      expect(frameHasName('rawField', names)).toBe(true);
    });

    it('returns false when name is in neither set', () => {
      expect(frameHasName('Unknown', names)).toBe(false);
    });
  });

  describe('getFrameFieldsDisplayNames', () => {
    it('returns empty sets and maps for empty data', () => {
      const result = getFrameFieldsDisplayNames([]);
      expect(result.display.size).toBe(0);
      expect(result.raw.size).toBe(0);
      expect(result.fields.size).toBe(0);
      expect(result.scopes.size).toBe(0);
    });

    it('collects display names and fields from a single frame', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'Value', type: FieldType.number, values: [10, 20, 30] },
        ],
      });
      const result = getFrameFieldsDisplayNames([frame]);
      expect(result.display).toEqual(new Set(['Time', 'Value']));
      expect(result.fields.get('Time')).toBe(frame.fields[0]);
      expect(result.fields.get('Value')).toBe(frame.fields[1]);
      expect(result.scopes.get('Time')).toBe('series');
      expect(result.scopes.get('Value')).toBe('series');
    });

    it('uses custom scope when provided', () => {
      const frame = toDataFrame({
        fields: [{ name: 'A', type: FieldType.string, values: ['x'] }],
      });
      const result = getFrameFieldsDisplayNames([frame], undefined, undefined, [frame], 'nested');
      expect(result.scopes.get('A')).toBe('nested');
    });

    it('adds raw name when display name differs from field name', () => {
      const frame = toDataFrame({
        fields: [
          {
            name: 'rawName',
            type: FieldType.number,
            values: [1],
            config: { displayName: 'Display Name' },
          },
        ],
      });
      const result = getFrameFieldsDisplayNames([frame]);
      expect(result.display.has('Display Name')).toBe(true);
      expect(result.raw.has('rawName')).toBe(true);
      expect(result.fields.get('Display Name')).toBe(frame.fields[0]);
      expect(result.fields.get('rawName')).toBe(frame.fields[0]);
      expect(result.scopes.get('Display Name')).toBe('series');
      expect(result.scopes.get('rawName')).toBe('series');
    });

    it('respects filter when provided', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1] },
          { name: 'Value', type: FieldType.number, values: [10] },
        ],
      });
      const onlyNumbers = (f: Field) => f.type === FieldType.number;
      const result = getFrameFieldsDisplayNames([frame], onlyNumbers);
      expect(result.display).toEqual(new Set(['Value']));
      expect(result.fields.size).toBe(1);
    });

    it('mutates and returns existingNames when provided', () => {
      const frame = toDataFrame({
        fields: [{ name: 'X', type: FieldType.string, values: ['a'] }],
      });
      const existingField = frame.fields[0];
      const existing: FrameFieldsDisplayNames = {
        display: new Set(['Existing']),
        raw: new Set(),
        fields: new Map([['Existing', existingField]]),
        scopes: new Map([['Existing', 'series']]),
      };
      const result = getFrameFieldsDisplayNames([frame], undefined, existing);
      expect(result).toBe(existing);
      expect(result.display.has('Existing')).toBe(true);
      expect(result.display.has('X')).toBe(true);
      expect(result.fields.get('X')).toBe(existingField);
    });

    it('recursively processes nested frames with nested scope', () => {
      const nestedFrame = toDataFrame({
        fields: [{ name: 'NestedField', type: FieldType.string, values: ['n'] }],
      });
      const parentFrame = toDataFrame({
        fields: [
          {
            name: 'nested',
            type: FieldType.nestedFrames,
            values: [[nestedFrame]],
            config: {},
          },
        ],
      });
      const result = getFrameFieldsDisplayNames([parentFrame]);
      expect(result.display.has('NestedField')).toBe(true);
      expect(result.scopes.get('NestedField')).toBe('nested');
    });

    it('handles multiple frames and merges names', () => {
      const frame1 = toDataFrame({
        fields: [{ name: 'A', type: FieldType.string, values: ['a'] }],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'A', type: FieldType.string, values: ['a'] },
          { name: 'B', type: FieldType.number, values: [1] },
        ],
      });
      const result = getFrameFieldsDisplayNames([frame1, frame2]);
      expect(result.display.has('A')).toBe(true);
      expect(result.display.has('B')).toBe(true);
      expect(result.fields.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('labels and descriptions', () => {
    describe.each(['series', 'nested', 'annotation', 'exemplar'] satisfies MatcherScope[])('%s', (scope) => {
      it('returns a label', () => {
        expect(getGroupLabelForScope(scope)).toBeDefined();
      });

      it('returns a description', () => {
        expect(getGroupDescriptionForScope(scope)).toBeDefined();
      });
    });
  });

  describe('useFieldDisplayNames', () => {
    it('returns result of getFrameFieldsDisplayNames for given data', () => {
      const frame = toDataFrame({
        fields: [{ name: 'F', type: FieldType.string, values: ['x'] }],
      });
      const { result } = renderHook(() => useFieldDisplayNames([frame]));
      expect(result.current.display.has('F')).toBe(true);
      expect(result.current.scopes.get('F')).toBe('series');
    });

    it('uses scope when provided', () => {
      const frame = toDataFrame({
        fields: [{ name: 'F', type: FieldType.string, values: ['x'] }],
      });
      const { result } = renderHook(() => useFieldDisplayNames([frame], undefined, 'nested'));
      expect(result.current.scopes.get('F')).toBe('nested');
    });

    it('updates when data reference changes', () => {
      const frame1 = toDataFrame({
        fields: [{ name: 'A', type: FieldType.string, values: ['a'] }],
      });
      const frame2 = toDataFrame({
        fields: [{ name: 'B', type: FieldType.string, values: ['b'] }],
      });
      const { result, rerender } = renderHook(({ data }: { data: DataFrame[] }) => useFieldDisplayNames(data), {
        initialProps: { data: [frame1] },
      });
      expect(result.current.display.has('A')).toBe(true);
      expect(result.current.display.has('B')).toBe(false);
      rerender({ data: [frame2] });
      expect(result.current.display.has('A')).toBe(false);
      expect(result.current.display.has('B')).toBe(true);
    });
  });

  describe('useMatcherSelectOptions', () => {
    const displayNames: FrameFieldsDisplayNames = {
      display: new Set(['DisplayA', 'DisplayB']),
      raw: new Set(['rawA']),
      fields: new Map([
        ['DisplayA', { name: 'DisplayA', type: FieldType.string, values: [], config: {} } as Field],
        ['DisplayB', { name: 'DisplayB', type: FieldType.number, values: [], config: {} } as Field],
        ['rawA', { name: 'rawA', type: FieldType.string, values: [], config: {} } as Field],
      ]),
      scopes: new Map([
        ['DisplayA', 'series'],
        ['DisplayB', 'series'],
        ['rawA', 'series'],
      ]),
    };

    it('returns options for display and raw names by default', () => {
      const { result } = renderHook(() => useMatcherSelectOptions(displayNames));
      const options = result.current;
      const values = options.map((o) => o.value);
      expect(values).toContain('DisplayA');
      expect(values).toContain('DisplayB');
      expect(values).toContain('rawA');
    });

    it('includes firstItem when provided', () => {
      const firstItem = { label: 'All', value: '__all__' };
      const { result } = renderHook(() => useMatcherSelectOptions(displayNames, undefined, { firstItem }));
      expect(result.current[0]).toEqual(firstItem);
    });

    it('adds (not found) option when currentName is not in names', () => {
      const { result } = renderHook(() => useMatcherSelectOptions(displayNames, 'MissingField'));
      const notFound = result.current.find((o) => o.value === 'MissingField');
      expect(notFound).toBeDefined();
      expect(notFound?.label).toContain('not found');
    });

    it('filters by scope when scope is provided', () => {
      const namesWithScopes: FrameFieldsDisplayNames = {
        ...displayNames,
        display: new Set(['SeriesField', 'NestedField']),
        raw: new Set(),
        fields: new Map([
          ['SeriesField', { name: 'SeriesField', type: FieldType.string, values: [], config: {} } as Field],
          ['NestedField', { name: 'NestedField', type: FieldType.string, values: [], config: {} } as Field],
        ]),
        scopes: new Map([
          ['SeriesField', 'series'],
          ['NestedField', 'nested'],
        ]),
      };
      const { result } = renderHook(() => useMatcherSelectOptions(namesWithScopes, undefined, { scope: 'nested' }));
      const values = result.current.map((o) => o.value);
      expect(values).toContain('NestedField');
      expect(values).not.toContain('SeriesField');
    });

    it('filters by fieldType when provided', () => {
      const { result } = renderHook(() =>
        useMatcherSelectOptions(displayNames, undefined, { fieldType: FieldType.number })
      );
      const values = result.current.map((o) => o.value);
      expect(values).toContain('DisplayB');
      expect(values).not.toContain('DisplayA');
    });

    it('uses OnlyBaseNames baseNameMode', () => {
      const { result } = renderHook(() =>
        useMatcherSelectOptions(displayNames, undefined, {
          baseNameMode: FieldNamePickerBaseNameMode.OnlyBaseNames,
        })
      );
      const labels = result.current.map((o) => o.label);
      expect(labels.some((l) => l?.includes('base field name'))).toBe(true);
    });

    it('uses ExcludeBaseNames baseNameMode', () => {
      const namesExcludeRaw: FrameFieldsDisplayNames = {
        display: new Set(['DisplayA']),
        raw: new Set(['rawA']),
        fields: new Map(),
        scopes: new Map(),
      };
      const { result } = renderHook(() =>
        useMatcherSelectOptions(namesExcludeRaw, undefined, {
          baseNameMode: FieldNamePickerBaseNameMode.ExcludeBaseNames,
        })
      );
      const values = result.current.map((o) => o.value);
      expect(values).toContain('DisplayA');
      expect(values).not.toContain('rawA');
    });
  });

  describe('getUniqueMatcherScopes', () => {
    it('returns empty set for empty data', () => {
      expect(getUniqueMatcherScopes([])).toEqual(new Set());
    });

    it('returns series scope for simple frame', () => {
      const frame = toDataFrame({
        fields: [{ name: 'A', type: FieldType.string, values: ['a'] }],
      });
      expect(getUniqueMatcherScopes([frame])).toEqual(new Set(['series']));
    });

    it('returns series and nested when nested frames present', () => {
      const nestedFrame = toDataFrame({
        fields: [{ name: 'N', type: FieldType.string, values: ['n'] }],
      });
      const parentFrame = toDataFrame({
        fields: [
          { name: 'P', type: FieldType.string, values: ['p'] },
          {
            name: 'nested',
            type: FieldType.nestedFrames,
            values: [[nestedFrame]],
            config: {},
          },
        ],
      });
      const scopes = getUniqueMatcherScopes([parentFrame]);
      expect(scopes.has('series')).toBe(true);
      expect(scopes.has('nested')).toBe(true);
    });
  });
});
