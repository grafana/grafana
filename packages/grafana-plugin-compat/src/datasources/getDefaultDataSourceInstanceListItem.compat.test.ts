import { type DataSourceInstanceListItem } from '@grafana/data';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: undefined,
}));

function listItem(overrides: Partial<DataSourceInstanceListItem>): DataSourceInstanceListItem {
  return {
    uid: 'uid',
    type: 'loki',
    name: 'name',
    meta: {},
    isDefault: false,
    ...overrides,
  } as DataSourceInstanceListItem;
}

describe('getDefaultDataSourceInstanceListItem', () => {
  it('should return the item flagged as default rather than the first one', () => {
    const items = [listItem({ uid: 'ds-a', name: 'A' }), listItem({ uid: 'ds-b', name: 'B', isDefault: true })];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });

  it('should return the first item when none is flagged as default', () => {
    const items = [listItem({ uid: 'ds-a', name: 'A' }), listItem({ uid: 'ds-b', name: 'B' })];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-a');
  });

  it('should return the first flagged item when more than one is flagged as default', () => {
    const items = [
      listItem({ uid: 'ds-a', name: 'A' }),
      listItem({ uid: 'ds-b', name: 'B', isDefault: true }),
      listItem({ uid: 'ds-c', name: 'C', isDefault: true }),
    ];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });

  it('should return undefined for an empty list', () => {
    expect(getDefaultDataSourceInstanceListItem([])).toBeUndefined();
  });

  it('should ignore a built-in that leads the list', () => {
    // Nothing is flagged, so without the built-in filter the leading item would win on order.
    const items = [
      listItem({ uid: 'ds-grafana', type: 'grafana', name: '-- Grafana --', meta: { builtIn: true } }),
      listItem({ uid: 'ds-b', name: 'B' }),
    ];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });

  it('should return undefined when every item is a built-in', () => {
    const items = [
      listItem({ uid: 'ds-mixed', type: 'mixed', name: '-- Mixed --', meta: { builtIn: true } }),
      listItem({ uid: 'ds-grafana', type: 'grafana', name: '-- Grafana --', meta: { builtIn: true } }),
    ];

    expect(getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should skip a nullish entry rather than throwing on it', () => {
    const items = [null, listItem({ uid: 'ds-b', name: 'B', isDefault: true })] as DataSourceInstanceListItem[];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });

  it('should not return a nullish entry as the first-item fallback', () => {
    const items = [null, listItem({ uid: 'ds-b', name: 'B' })] as DataSourceInstanceListItem[];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });
});
