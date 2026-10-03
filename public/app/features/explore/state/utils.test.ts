import { dateTime, rangeUtil, systemDateFormats, toURLRange } from '@grafana/data';
import { getLocalRichHistoryStorage } from 'app/core/history/richHistoryStorageProvider';
import * as exploreUtils from 'app/core/utils/explore';

import { loadAndInitDatasource, getRange, fromURLRange, createCacheKey, MAX_HISTORY_AUTOCOMPLETE_ITEMS } from './utils';

describe('nanosecond URL ranges', () => {
  it('preserves exact bounds when loading and serializing an Explore URL', () => {
    const urlRange = { from: '1970-01-01T00:00:00.123000001Z', to: '1970-01-01T00:00:00.123999999Z' };
    const range = getRange(fromURLRange(urlRange), 'utc');
    expect(range.fromNano).toBe(1);
    expect(range.toNano).toBe(999999);
    expect(toURLRange(range.raw)).toEqual(urlRange);
    expect(createCacheKey(rangeUtil.toAbsoluteTimeRange(range))).toBe('from=123&to=123&fromNano=1&toNano=999999');
    expect(createCacheKey({ from: 123, to: 123 })).toBe('from=123&to=123');
  });
});

const mockGetDataSourceInstance = jest.fn();
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (...args: unknown[]) => mockGetDataSourceInstance(...args),
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
    mockGetDataSourceInstance.mockRejectedValueOnce(new Error('Datasource not found'));
    mockGetDataSourceInstance.mockResolvedValue(DEFAULT_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValue({ total: 0, richHistory: [] });

    const { instance } = await loadAndInitDatasource(1, { uid: 'Unknown' });

    expect(mockGetDataSourceInstance).toBeCalledTimes(2);
    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'Unknown' });
    expect(mockGetDataSourceInstance).toHaveBeenCalledWith();
    expect(instance).toMatchObject(DEFAULT_DATASOURCE);
    expect(setLastUsedDatasourceUIDSpy).toHaveBeenCalledWith(1, DEFAULT_DATASOURCE.uid);
  });

  it('saves last loaded data source uid', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    mockGetDataSourceInstance.mockResolvedValue(TEST_DATASOURCE);
    mockLocalDataStorage.getRichHistory.mockResolvedValue({
      total: 0,
      richHistory: [],
    });

    const { instance } = await loadAndInitDatasource(1, { uid: 'Test' });

    expect(mockGetDataSourceInstance).toHaveBeenCalledTimes(1);
    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'Test' });
    expect(getLocalRichHistoryStorage).toHaveBeenCalledTimes(1);

    expect(instance).toMatchObject(TEST_DATASOURCE);
    expect(setLastUsedDatasourceUIDSpy).toHaveBeenCalledWith(1, TEST_DATASOURCE.uid);
  });

  it('pulls history data and returns the history by query', async () => {
    setLastUsedDatasourceUIDSpy = jest.spyOn(exploreUtils, 'setLastUsedDatasourceUID');
    mockGetDataSourceInstance.mockResolvedValue(TEST_DATASOURCE);
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
    mockGetDataSourceInstance.mockResolvedValue(TEST_DATASOURCE);
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
    mockGetDataSourceInstance.mockResolvedValue(TEST_DATASOURCE);
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
  it('parses ISO offset URLs independently of the configured date format', () => {
    const original = systemDateFormats.fullDate;
    try {
      systemDateFormats.fullDate = 'DD/MM/YYYY HH:mm:ss';
      const result = fromURLRange({ from: '2026-09-30T13:00:00-07:00', to: '2026-09-30T14:00:00-07:00' });
      expect(result.from.valueOf()).toBe(1790798400000);
      expect(result.to.valueOf()).toBe(1790802000000);
    } finally {
      systemDateFormats.fullDate = original;
    }
  });

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
