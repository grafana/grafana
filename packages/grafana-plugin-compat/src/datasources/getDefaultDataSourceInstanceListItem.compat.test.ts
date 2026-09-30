import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';

import { getMockedDatasourceSrv, getMockedListItem } from '../utils/mocks';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();

function givenDefaultUids(...defaultUids: string[]) {
  mockDatasourceSrv.getInstanceSettings.mockImplementation(
    (uid: string) => ({ uid, isDefault: defaultUids.includes(uid) }) as DataSourceInstanceSettings
  );
}

describe('getDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should return the item whose instance settings are flagged as default', async () => {
    givenDefaultUids('ds-b');
    const items = [getMockedListItem({ uid: 'ds-a', name: 'A' }), getMockedListItem({ uid: 'ds-b', name: 'B' })];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith('ds-b');
  });

  it('should return undefined when no item is flagged', async () => {
    givenDefaultUids();
    const items = [getMockedListItem({ uid: 'ds-a', name: 'A' }), getMockedListItem({ uid: 'ds-b', name: 'B' })];

    expect(await getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should return the first flagged item when more than one is flagged', async () => {
    givenDefaultUids('ds-b', 'ds-c');
    const items = [
      getMockedListItem({ uid: 'ds-a', name: 'A' }),
      getMockedListItem({ uid: 'ds-b', name: 'B' }),
      getMockedListItem({ uid: 'ds-c', name: 'C' }),
    ];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
  });

  it('should return undefined for an empty list', async () => {
    expect(await getDefaultDataSourceInstanceListItem([])).toBeUndefined();
  });

  it('should return undefined when the instance settings cannot be resolved', async () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(undefined);

    expect(await getDefaultDataSourceInstanceListItem([getMockedListItem({ uid: 'ds-a' })])).toBeUndefined();
  });

  it('should never return a built-in', async () => {
    givenDefaultUids();
    const items = [
      getMockedListItem({ uid: 'ds-mixed', type: 'mixed', name: '-- Mixed --', meta: { builtIn: true } }),
      getMockedListItem({ uid: 'ds-grafana', type: 'grafana', name: '-- Grafana --', meta: { builtIn: true } }),
    ];

    expect(await getDefaultDataSourceInstanceListItem(items)).toBeUndefined();
  });

  it('should skip a nullish entry rather than throwing on it', async () => {
    givenDefaultUids('ds-b');
    const items = [null, getMockedListItem({ uid: 'ds-b', name: 'B' })] as DataSourceInstanceListItem[];

    expect((await getDefaultDataSourceInstanceListItem(items))?.uid).toBe('ds-b');
  });
});
