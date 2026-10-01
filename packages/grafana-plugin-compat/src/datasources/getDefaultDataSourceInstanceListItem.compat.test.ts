import { type DataSourceInstanceListItem } from '@grafana/data';

import { getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: undefined,
}));

describe('getDefaultDataSourceInstanceListItem', () => {
  it('should return the flagged item', async () => {
    const items = [
      getMockedListItem({ uid: 'ds-a', name: 'A' }),
      getMockedListItem({ uid: 'ds-b', name: 'B', isDefault: true }),
    ];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
  });

  it('should return undefined when no item is flagged', async () => {
    const items = [getMockedListItem({ uid: 'ds-a', name: 'A' }), getMockedListItem({ uid: 'ds-b', name: 'B' })];

    expect(await getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should return the first flagged item when more than one is flagged', async () => {
    const items = [
      getMockedListItem({ uid: 'ds-a', name: 'A' }),
      getMockedListItem({ uid: 'ds-b', name: 'B', isDefault: true }),
      getMockedListItem({ uid: 'ds-c', name: 'C', isDefault: true }),
    ];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
  });

  it('should return undefined for an empty list', async () => {
    expect(await getDefaultDataSourceInstanceListItem([])).toBeUndefined();
  });

  it('should never return a built-in', async () => {
    const items = [
      getMockedListItem({ uid: 'ds-mixed', type: 'mixed', name: '-- Mixed --', meta: { builtIn: true } }),
      getMockedListItem({ uid: 'ds-grafana', type: 'grafana', name: '-- Grafana --', meta: { builtIn: true } }),
    ];

    expect(await getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should skip a nullish entry rather than throwing on it', async () => {
    const items = [
      null,
      getMockedListItem({ uid: 'ds-b', name: 'B', isDefault: true }),
    ] as DataSourceInstanceListItem[];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
  });
});
