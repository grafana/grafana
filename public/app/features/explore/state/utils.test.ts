import { dateTime } from '@grafana/data';

import store from '../../../core/store';
import { lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';

const dataSourceMock = {
  get: jest.fn(),
};
jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => dataSourceMock),
}));

jest.spyOn(store, 'set');

import { loadAndInitDatasource, getRange } from './utils';

const DEFAULT_DATASOURCE = { uid: 'abc123', name: 'Default' };
const TEST_DATASOURCE = { uid: 'def789', name: 'Test' };

describe('loadAndInitDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to default datasource if the provided one was not found', async () => {
    dataSourceMock.get.mockRejectedValueOnce(new Error('Datasource not found'));
    dataSourceMock.get.mockResolvedValue(DEFAULT_DATASOURCE);

    const { instance } = await loadAndInitDatasource(1, { uid: 'Unknown' });

    expect(dataSourceMock.get).toBeCalledTimes(2);
    expect(dataSourceMock.get).toBeCalledWith({ uid: 'Unknown' });
    expect(dataSourceMock.get).toBeCalledWith();
    expect(instance).toMatchObject(DEFAULT_DATASOURCE);
    expect(store.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), DEFAULT_DATASOURCE.uid);
  });

  it('saves last loaded data source uid', async () => {
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);

    const { instance } = await loadAndInitDatasource(1, { uid: 'Test' });

    expect(dataSourceMock.get).toBeCalledTimes(1);
    expect(dataSourceMock.get).toBeCalledWith({ uid: 'Test' });
    expect(instance).toMatchObject(TEST_DATASOURCE);
    expect(store.set).toBeCalledWith(lastUsedDatasourceKeyForOrgId(1), TEST_DATASOURCE.uid);
  });
});

describe('getRange', () => {
  it('should parse moment date', () => {
    // convert date strings to moment object
    const range = { from: dateTime('2020-10-22T10:44:33.615Z'), to: dateTime('2020-10-22T10:49:33.615Z') };
    const result = getRange(range, 'browser');
    expect(result.raw).toEqual(range);
  });

  it('should parse epoch strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').valueOf().toString(),
      to: dateTime('2020-10-22T11:00:00Z').valueOf().toString(),
    };
    const result = getRange(range, 'browser');
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });

  it('should parse ISO strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').toISOString(),
      to: dateTime('2020-10-22T11:00:00Z').toISOString(),
    };
    const result = getRange(range, 'browser');
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });
});
