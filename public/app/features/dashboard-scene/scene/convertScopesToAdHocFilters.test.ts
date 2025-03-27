import { Scope, ScopeSpecFilter } from '@grafana/data';
import { FilterOrigin } from '@grafana/scenes';

import { convertScopesToAdHocFilters } from './convertScopesToAdHocFilters';

describe('convertScopesToAdHocFilters', () => {
  it('should return empty filters when no scopes are provided', () => {
    let scopes = generateScopes([]);

    expect(scopes).toEqual([]);
    expect(convertScopesToAdHocFilters(scopes)).toEqual([]);

    scopes = generateScopes([[], []]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([]);
  });

  it('should return filters formatted for adHoc from a single scope', () => {
    let scopes = generateScopes([
      [
        { key: 'key1', value: 'value1', operator: 'equals' },
        { key: 'key2', value: 'value2', operator: 'not-equals' },
        { key: 'key3', value: 'value3', operator: 'regex-not-match' },
      ],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      { key: 'key1', value: 'value1', operator: '=', origin: FilterOrigin.Scopes, values: ['value1'] },
      { key: 'key2', value: 'value2', operator: '!=', origin: FilterOrigin.Scopes, values: ['value2'] },
      { key: 'key3', value: 'value3', operator: '!~', origin: FilterOrigin.Scopes, values: ['value3'] },
    ]);

    scopes = generateScopes([[{ key: 'key3', value: 'value3', operator: 'regex-match' }]]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      { key: 'key3', value: 'value3', operator: '=~', origin: FilterOrigin.Scopes, values: ['value3'] },
    ]);
  });

  it('should return filters formatted for adHoc from multiple scopes with single values', () => {
    let scopes = generateScopes([
      [{ key: 'key1', value: 'value1', operator: 'equals' }],
      [{ key: 'key2', value: 'value2', operator: 'regex-match' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      { key: 'key1', value: 'value1', operator: '=', origin: FilterOrigin.Scopes, values: ['value1'] },
      { key: 'key2', value: 'value2', operator: '=~', origin: FilterOrigin.Scopes, values: ['value2'] },
    ]);
  });

  it('should return filters formatted for adHoc from multiple scopes with multiple values', () => {
    let scopes = generateScopes([
      [
        { key: 'key1', value: 'value1', operator: 'equals' },
        { key: 'key2', value: 'value2', operator: 'not-equals' },
      ],
      [
        { key: 'key3', value: 'value3', operator: 'regex-match' },
        { key: 'key4', value: 'value4', operator: 'regex-match' },
      ],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      { key: 'key1', value: 'value1', operator: '=', origin: FilterOrigin.Scopes, values: ['value1'] },
      { key: 'key2', value: 'value2', operator: '!=', origin: FilterOrigin.Scopes, values: ['value2'] },
      { key: 'key3', value: 'value3', operator: '=~', origin: FilterOrigin.Scopes, values: ['value3'] },
      { key: 'key4', value: 'value4', operator: '=~', origin: FilterOrigin.Scopes, values: ['value4'] },
    ]);
  });

  it('should return formatted filters and concat values of the same key, coming from different scopes, if operator supports multi-value', () => {
    let scopes = generateScopes([
      [
        { key: 'key1', value: 'value1', operator: 'equals' },
        { key: 'key2', value: 'value2', operator: 'not-equals' },
      ],
      [
        { key: 'key1', value: 'value3', operator: 'equals' },
        { key: 'key2', value: 'value4', operator: 'not-equals' },
      ],
      [{ key: 'key1', value: 'value5', operator: 'equals' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=|',
        origin: FilterOrigin.Scopes,
        values: ['value1', 'value3', 'value5'],
      },
      { key: 'key2', value: 'value2', operator: '!=|', origin: FilterOrigin.Scopes, values: ['value2', 'value4'] },
    ]);
  });

  it('should ignore the rest of the duplicate filters, if they are a combination of equals and not-equals', () => {
    let scopes = generateScopes([
      [{ key: 'key1', value: 'value1', operator: 'equals' }],
      [{ key: 'key1', value: 'value2', operator: 'not-equals' }],
      [{ key: 'key1', value: 'value3', operator: 'equals' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=|',
        origin: FilterOrigin.Scopes,
        values: ['value1', 'value3'],
      },
      {
        key: 'key1',
        value: 'value2',
        operator: '!=',
        origin: FilterOrigin.Scopes,
        values: ['value2'],
      },
    ]);
  });

  it('should return formatted filters and keep only the first filter of the same key if operator is not multi-value', () => {
    let scopes = generateScopes([
      [
        { key: 'key1', value: 'value1', operator: 'regex-match' },
        { key: 'key2', value: 'value2', operator: 'not-equals' },
      ],
      [
        { key: 'key1', value: 'value3', operator: 'regex-match' },
        { key: 'key2', value: 'value4', operator: 'not-equals' },
      ],
      [{ key: 'key1', value: 'value5', operator: 'equals' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value1'],
      },
      { key: 'key2', value: 'value2', operator: '!=|', origin: FilterOrigin.Scopes, values: ['value2', 'value4'] },
      {
        key: 'key1',
        value: 'value3',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value3'],
      },
      {
        key: 'key1',
        value: 'value5',
        operator: '=',
        origin: FilterOrigin.Scopes,
        values: ['value5'],
      },
    ]);

    scopes = generateScopes([
      [{ key: 'key1', value: 'value1', operator: 'regex-match' }],
      [{ key: 'key1', value: 'value5', operator: 'equals' }],
      [{ key: 'key1', value: 'value3', operator: 'regex-match' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value1'],
      },
      {
        key: 'key1',
        value: 'value5',
        operator: '=',
        origin: FilterOrigin.Scopes,
        values: ['value5'],
      },
      {
        key: 'key1',
        value: 'value3',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value3'],
      },
    ]);
  });

  it('should return formatted filters and concat values that are multi-value and drop duplicates with non multi-value operator', () => {
    let scopes = generateScopes([
      [{ key: 'key1', value: 'value1', operator: 'equals' }],
      [{ key: 'key1', value: 'value2', operator: 'regex-match' }],
      [{ key: 'key1', value: 'value3', operator: 'equals' }],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=|',
        origin: FilterOrigin.Scopes,
        values: ['value1', 'value3'],
      },
      {
        key: 'key1',
        value: 'value2',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value2'],
      },
    ]);

    scopes = generateScopes([
      [
        { key: 'key1', value: 'value1', operator: 'equals' },
        { key: 'key2', value: 'value2', operator: 'equals' },
      ],
      [
        { key: 'key1', value: 'value3', operator: 'equals' },
        { key: 'key2', value: 'value4', operator: 'equals' },
      ],
      [
        { key: 'key1', value: 'value5', operator: 'regex-match' },
        { key: 'key2', value: 'value6', operator: 'equals' },
      ],
      [
        { key: 'key1', value: 'value7', operator: 'equals' },
        { key: 'key2', value: 'value8', operator: 'regex-match' },
      ],
      [
        { key: 'key1', value: 'value9', operator: 'equals' },
        { key: 'key2', value: 'value10', operator: 'equals' },
      ],
    ]);

    expect(convertScopesToAdHocFilters(scopes)).toEqual([
      {
        key: 'key1',
        value: 'value1',
        operator: '=|',
        origin: FilterOrigin.Scopes,
        values: ['value1', 'value3', 'value7', 'value9'],
      },
      {
        key: 'key2',
        value: 'value2',
        operator: '=|',
        origin: FilterOrigin.Scopes,
        values: ['value2', 'value4', 'value6', 'value10'],
      },
      {
        key: 'key1',
        value: 'value5',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value5'],
      },
      {
        key: 'key2',
        value: 'value8',
        operator: '=~',
        origin: FilterOrigin.Scopes,
        values: ['value8'],
      },
    ]);
  });
});

function generateScopes(filtersSpec: ScopeSpecFilter[][]) {
  const scopes: Scope[] = [];

  for (let i = 0; i < filtersSpec.length; i++) {
    scopes.push({
      metadata: { name: `name-${i}` },
      spec: {
        title: `scope-${i}`,
        type: '',
        description: 'desc',
        category: '',
        filters: filtersSpec[i],
      },
    });
  }

  return scopes;
}
