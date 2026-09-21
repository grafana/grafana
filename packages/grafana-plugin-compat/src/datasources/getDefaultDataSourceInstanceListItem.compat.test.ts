import { type DataSourceInstanceListItem, type DataSourcePluginMeta } from '@grafana/data';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: undefined,
}));

// `meta` is partial so a case can set just the one flag it cares about.
function listItem({
  meta,
  ...rest
}: Partial<Omit<DataSourceInstanceListItem, 'meta'>> & {
  meta?: Partial<DataSourcePluginMeta>;
}): DataSourceInstanceListItem {
  return {
    uid: 'uid',
    type: 'loki',
    name: 'name',
    isDefault: false,
    ...rest,
    meta: { ...meta },
  } as DataSourceInstanceListItem;
}

describe('getDefaultDataSourceInstanceListItem', () => {
  it('should return the flagged item rather than the first one', () => {
    const items = [listItem({ uid: 'ds-a', name: 'A' }), listItem({ uid: 'ds-b', name: 'B', isDefault: true })];

    expect(getDefaultDataSourceInstanceListItem(items)?.uid).toBe('ds-b');
  });

  it('should return undefined when no item is flagged, rather than falling back to the first', () => {
    const items = [listItem({ uid: 'ds-a', name: 'A' }), listItem({ uid: 'ds-b', name: 'B' })];

    expect(getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should return the first flagged item when more than one is flagged', () => {
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

  it('should never return a built-in, which is what a list-order fallback would pick', () => {
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
});
