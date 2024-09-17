// CustomHook.test.js
import { renderHook } from '@testing-library/react-hooks';
import { MockDataSourceApi, DatasourceSrvMock } from 'test/mocks/datasource_srv';

import { useDatasourcesFromTargets } from './useDatasourcesFromTargets'; // Update the path accordingly

const defaultDs = new MockDataSourceApi('default datasource', { data: ['default data'] });
const ds1 = new MockDataSourceApi('dataSource1');
const ds2 = new MockDataSourceApi('dataSource2') as MockDataSourceApi;

const datasourceSrv = new DatasourceSrvMock(defaultDs, {
  dataSource1: ds1,
  dataSource2: ds2,
});
const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

describe('useDatasourcesFromTargets', () => {
  it('returns an empty map when targets are not provided', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useDatasourcesFromTargets(undefined));

    await waitForNextUpdate();

    expect(result.current.size).toBe(0);
  });

  it('fetches and returns the data sources map', async () => {
    const mockTargets = [
      { refId: '1', datasource: { uid: 'dataSource1' } },
      { refId: '2', datasource: { uid: 'dataSource2' } },
    ];

    const { result, waitForNextUpdate } = renderHook(() => useDatasourcesFromTargets(mockTargets));

    await waitForNextUpdate();

    expect(result.current.size).toBe(2);
    expect(result.current.get('1')).toEqual(ds1);
    expect(result.current.get('2')).toEqual(ds2);
  });
});
