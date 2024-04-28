import { dateTime } from '@grafana/data';
import { getLocalRichHistoryStorage } from 'app/core/history/richHistoryStorageProvider';
import * as exploreUtils from 'app/core/utils/explore';

import { loadAndInitDatasource, getRange, fromURLRange, MAX_HISTORY_AUTOCOMPLETE_ITEMS } from './utils';

const dataSourceMock = {
  get: jest.fn(),
};
jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => dataSourceMock),
}));

const mockLocalDataStorage = {
  getRichHistory: jest.fn(),
};

jest.mock('app/core/history/richHistoryStorageProvider', () => ({
  getLocalRichHistoryStorage: jest.fn(() => {
    return mockLocalDataStorage;
  }),
}));

const DEFAULT_DATASOURCE = { uid: 'abc123', name: 'Default' };
const TEST_DATASOURCE = { uid: 'def789', name: 'Test' };

describe('loadAndInitDatasource', () => {
  let setLastUsedDatasourceUIDSpy;

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('falls back to default datasource if the provided one was not found', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    dataSourceMock.get.mockRejectedValueOnce(new Error('Datasource not found'));
    dataSourceMock.get.mockResolvedValue(DEFAULT_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValue({ total: 0, richHistory: [] });

    const { instance } = await loadAndInitDatasource(1, { uid: 'Unknown' });

    expect(dataSourceMock.get).toBeCalledTimes(2);
    expect(dataSourceMock.get).toBeCalledWith({ uid: 'Unknown' });
    expect(dataSourceMock.get).toBeCalledWith();
    expect(instance).toMatchObject(DEFAULT_DATASOURCE);
    expect(setLastUsedDatasourceUIDSpy).toBeCalledWith(1, DEFAULT_DATASOURCE.uid);
  });

  it('saves last loaded data source uid', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValue({
      total: 0,
      richHistory: [],
    });

    const { instance } = await loadAndInitDatasource(1, { uid: 'Test' });

    expect(dataSourceMock.get).toHaveBeenCalledTimes(1);
    expect(dataSourceMock.get).toHaveBeenCalledWith({ uid: 'Test' });
    expect(getLocalRichHistoryStorage).toHaveBeenCalledTimes(1);

    expect(instance).toMatchObject(TEST_DATASOURCE);
    expect(setLastUsedDatasourceUIDSpy).toBeCalledWith(1, TEST_DATASOURCE.uid);
  });

  it('pulls history data and returns the history by query', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValueOnce({
      total: 1,
      richHistory: [
        {
          id: '0',
          createdAt: 0,
          datasourceUid: 'Test',
          datasourceName: 'Test',
          starred: false,
          comment: '',
          queries: [{ refId: 'A' }, { refId: 'B' }],
        },
      ],
    });

    const { history } = await loadAndInitDatasource(1, { uid: 'Test' });
    expect(getLocalRichHistoryStorage).toHaveBeenCalledTimes(1);
    expect(history.length).toEqual(2);
  });

  it('pulls history data and returns the history by query with Mixed results', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValueOnce({
      total: 1,
      richHistory: [
        {
          id: '0',
          createdAt: 0,
          datasourceUid: 'Test',
          datasourceName: 'Test',
          starred: false,
          comment: '',
          queries: [{ refId: 'A' }, { refId: 'B' }],
        },
      ],
    });

    mockLocalDataStorage.getRichHistory.mockResolvedValueOnce({
      total: 1,
      richHistory: [
        {
          id: '0',
          createdAt: 0,
          datasourceUid: 'Mixed',
          datasourceName: 'Mixed',
          starred: false,
          comment: '',
          queries: [
            { refId: 'A', datasource: { uid: 'def789' } },
            { refId: 'B', datasource: { uid: 'def789' } },
          ],
        },
      ],
    });

    const { history } = await loadAndInitDatasource(1, { uid: 'Test' });
    expect(getLocalRichHistoryStorage).toHaveBeenCalledTimes(1);
    expect(history.length).toEqual(4);
  });

  it('pulls history data and returns only a max of MAX_HISTORY_AUTOCOMPLETE_ITEMS items', async () => {
    const queryList = [...Array(MAX_HISTORY_AUTOCOMPLETE_ITEMS + 50).keys()].map((i) => {
      return { refId: `ref-${i}` };
    });

    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    dataSourceMock.get.mockResolvedValue(TEST_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValueOnce({
      total: 1,
      richHistory: [
        {
          id: '0',
          createdAt: 0,
          datasourceUid: 'Test',
          datasourceName: 'Test',
          starred: false,
          comment: '',
          queries: queryList,
        },
      ],
    });

    const { history } = await loadAndInitDatasource(1, { uid: 'Test' });
    expect(getLocalRichHistoryStorage).toHaveBeenCalledTimes(1);
    expect(history.length).toEqual(MAX_HISTORY_AUTOCOMPLETE_ITEMS);
  });
});

describe('getRange', () => {
  it('should parse moment date', () => {
    // convert date strings to moment object
    const range = { from: dateTime('2020-10-22T10:44:33.615Z'), to: dateTime('2020-10-22T10:49:33.615Z') };
    const result = getRange(range, 'browser');
    expect(result.raw).toEqual(range);
  });
});

describe('fromURLRange', () => {
  it('should parse epoch strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').valueOf().toString(),
      to: dateTime('2020-10-22T11:00:00Z').valueOf().toString(),
    };
    const result = fromURLRange(range);
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });

  it('should parse ISO strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').toISOString(),
      to: dateTime('2020-10-22T11:00:00Z').toISOString(),
    };
    const result = fromURLRange(range);
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });
});
