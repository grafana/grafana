import {
  buildQueryTransaction,
  clearHistory,
  DEFAULT_RANGE,
  getFirstQueryErrorWithoutRefId,
  getRefIds,
  getValueWithRefId,
  hasNonEmptyQuery,
  parseUrlState,
  refreshIntervalToSortOrder,
  serializeStateToUrlParam,
  sortLogsResult,
  SortOrder,
  updateHistory,
} from './explore';
import { ExploreUrlState } from 'app/types/explore';
import store from 'app/core/store';
import {
  DataQueryError,
  dateTime,
  ExploreMode,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsModel,
  MutableDataFrame,
} from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';

const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  datasource: '',
  queries: [],
  range: DEFAULT_RANGE,
  mode: ExploreMode.Metrics,
  ui: {
    showingGraph: true,
    showingTable: true,
    showingLogs: true,
    dedupStrategy: LogsDedupStrategy.none,
  },
  originPanelId: undefined,
};

describe('state functions', () => {
  describe('parseUrlState', () => {
    it('returns default state on empty string', () => {
      expect(parseUrlState('')).toMatchObject({
        datasource: null,
        queries: [],
        range: DEFAULT_RANGE,
      });
    });

    it('returns a valid Explore state from URL parameter', () => {
      const paramValue =
        '%7B"datasource":"Local","queries":%5B%7B"expr":"metric"%7D%5D,"range":%7B"from":"now-1h","to":"now"%7D%7D';
      expect(parseUrlState(paramValue)).toMatchObject({
        datasource: 'Local',
        queries: [{ expr: 'metric' }],
        range: {
          from: 'now-1h',
          to: 'now',
        },
      });
    });

    it('returns a valid Explore state from a compact URL parameter', () => {
      const paramValue = '%5B"now-1h","now","Local","5m",%7B"expr":"metric"%7D,"ui"%5D';
      expect(parseUrlState(paramValue)).toMatchObject({
        datasource: 'Local',
        queries: [{ expr: 'metric' }],
        range: {
          from: 'now-1h',
          to: 'now',
        },
      });
    });
  });

  describe('serializeStateToUrlParam', () => {
    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
          },
          {
            expr: 'super{foo="x/z"}',
          },
        ],
        range: {
          from: 'now-5h',
          to: 'now',
        },
      };

      expect(serializeStateToUrlParam(state)).toBe(
        '{"datasource":"foo","queries":[{"expr":"metric{test=\\"a/b\\"}"},' +
          '{"expr":"super{foo=\\"x/z\\"}"}],"range":{"from":"now-5h","to":"now"},' +
          '"mode":"Metrics",' +
          '"ui":{"showingGraph":true,"showingTable":true,"showingLogs":true,"dedupStrategy":"none"}}'
      );
    });

    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
          },
          {
            expr: 'super{foo="x/z"}',
          },
        ],
        range: {
          from: 'now-5h',
          to: 'now',
        },
      };
      expect(serializeStateToUrlParam(state, true)).toBe(
        '["now-5h","now","foo",{"expr":"metric{test=\\"a/b\\"}"},{"expr":"super{foo=\\"x/z\\"}"},{"mode":"Metrics"},{"ui":[true,true,true,"none"]}]'
      );
    });
  });

  describe('interplay', () => {
    it('can parse the serialized state into the original state', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
          },
          {
            expr: 'super{foo="x/z"}',
          },
        ],
        range: {
          from: 'now - 5h',
          to: 'now',
        },
      };
      const serialized = serializeStateToUrlParam(state);
      const parsed = parseUrlState(serialized);
      expect(state).toMatchObject(parsed);
    });

    it('can parse the compact serialized state into the original state', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
          },
          {
            expr: 'super{foo="x/z"}',
          },
        ],
        range: {
          from: 'now - 5h',
          to: 'now',
        },
      };
      const serialized = serializeStateToUrlParam(state, true);
      const parsed = parseUrlState(serialized);
      expect(state).toMatchObject(parsed);
    });
  });
});

describe('updateHistory()', () => {
  const datasourceId = 'myDatasource';
  const key = `grafana.explore.history.${datasourceId}`;

  beforeEach(() => {
    clearHistory(datasourceId);
    expect(store.exists(key)).toBeFalsy();
  });

  test('should save history item to localStorage', () => {
    const expected = [
      {
        query: { refId: '1', expr: 'metric' },
      },
    ];
    expect(updateHistory([], datasourceId, [{ refId: '1', expr: 'metric' }])).toMatchObject(expected);
    expect(store.exists(key)).toBeTruthy();
    expect(store.getObject(key)).toMatchObject(expected);
  });
});

describe('hasNonEmptyQuery', () => {
  test('should return true if one query is non-empty', () => {
    expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'explore', expr: 'foo' }])).toBeTruthy();
  });

  test('should return false if query is empty', () => {
    expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'panel' }])).toBeFalsy();
  });

  test('should return false if no queries exist', () => {
    expect(hasNonEmptyQuery([])).toBeFalsy();
  });
});

describe('hasRefId', () => {
  describe('when called with a null value', () => {
    it('then it should return undefined', () => {
      const input: any = null;
      const result = getValueWithRefId(input);

      expect(result).toBeUndefined();
    });
  });

  describe('when called with a non object value', () => {
    it('then it should return undefined', () => {
      const input = 123;
      const result = getValueWithRefId(input);

      expect(result).toBeUndefined();
    });
  });

  describe('when called with an object that has refId', () => {
    it('then it should return the object', () => {
      const input = { refId: 'A' };
      const result = getValueWithRefId(input);

      expect(result).toBe(input);
    });
  });

  describe('when called with an array that has refId', () => {
    it('then it should return the object', () => {
      const input = [123, null, {}, { refId: 'A' }];
      const result = getValueWithRefId(input);

      expect(result).toBe(input[3]);
    });
  });

  describe('when called with an object that has refId somewhere in the object tree', () => {
    it('then it should return the object', () => {
      const input: any = { data: [123, null, {}, { series: [123, null, {}, { refId: 'A' }] }] };
      const result = getValueWithRefId(input);

      expect(result).toBe(input.data[3].series[3]);
    });
  });
});

describe('getFirstQueryErrorWithoutRefId', () => {
  describe('when called with a null value', () => {
    it('then it should return undefined', () => {
      const errors: DataQueryError[] | undefined = undefined;
      const result = getFirstQueryErrorWithoutRefId(errors);

      expect(result).toBeUndefined();
    });
  });

  describe('when called with an array with only refIds', () => {
    it('then it should return undefined', () => {
      const errors: DataQueryError[] = [{ refId: 'A' }, { refId: 'B' }];
      const result = getFirstQueryErrorWithoutRefId(errors);

      expect(result).toBeUndefined();
    });
  });

  describe('when called with an array with and without refIds', () => {
    it('then it should return undefined', () => {
      const errors: DataQueryError[] = [
        { refId: 'A' },
        { message: 'A message' },
        { refId: 'B' },
        { message: 'B message' },
      ];
      const result = getFirstQueryErrorWithoutRefId(errors);

      expect(result).toBe(errors[1]);
    });
  });
});

describe('getRefIds', () => {
  describe('when called with a null value', () => {
    it('then it should return empty array', () => {
      const input: any = null;
      const result = getRefIds(input);

      expect(result).toEqual([]);
    });
  });

  describe('when called with a non object value', () => {
    it('then it should return empty array', () => {
      const input = 123;
      const result = getRefIds(input);

      expect(result).toEqual([]);
    });
  });

  describe('when called with an object that has refId', () => {
    it('then it should return an array with that refId', () => {
      const input = { refId: 'A' };
      const result = getRefIds(input);

      expect(result).toEqual(['A']);
    });
  });

  describe('when called with an array that has refIds', () => {
    it('then it should return an array with unique refIds', () => {
      const input = [123, null, {}, { refId: 'A' }, { refId: 'A' }, { refId: 'B' }];
      const result = getRefIds(input);

      expect(result).toEqual(['A', 'B']);
    });
  });

  describe('when called with an object that has refIds somewhere in the object tree', () => {
    it('then it should return return an array with unique refIds', () => {
      const input: any = {
        data: [
          123,
          null,
          { refId: 'B', series: [{ refId: 'X' }] },
          { refId: 'B' },
          {},
          { series: [123, null, {}, { refId: 'A' }] },
        ],
      };
      const result = getRefIds(input);

      expect(result).toEqual(['B', 'X', 'A']);
    });
  });
});

describe('refreshIntervalToSortOrder', () => {
  describe('when called with live option', () => {
    it('then it should return ascending', () => {
      const result = refreshIntervalToSortOrder(RefreshPicker.liveOption.value);

      expect(result).toBe(SortOrder.Ascending);
    });
  });

  describe('when called with off option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(RefreshPicker.offOption.value);

      expect(result).toBe(SortOrder.Descending);
    });
  });

  describe('when called with 5s option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder('5s');

      expect(result).toBe(SortOrder.Descending);
    });
  });

  describe('when called with undefined', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(undefined);

      expect(result).toBe(SortOrder.Descending);
    });
  });
});

describe('sortLogsResult', () => {
  const firstRow: LogRowModel = {
    rowIndex: 0,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame(),
    entry: '',
    hasAnsi: false,
    labels: {},
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 0,
    timeEpochNs: '0',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '1',
  };
  const sameAsFirstRow = firstRow;
  const secondRow: LogRowModel = {
    rowIndex: 1,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame(),
    entry: '',
    hasAnsi: false,
    labels: {},
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 10,
    timeEpochNs: '10000000',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '2',
  };

  describe('when called with SortOrder.Descending', () => {
    it('then it should sort descending', () => {
      const logsResult: LogsModel = {
        rows: [firstRow, sameAsFirstRow, secondRow],
        hasUniqueLabels: false,
      };
      const result = sortLogsResult(logsResult, SortOrder.Descending);

      expect(result).toEqual({
        rows: [secondRow, firstRow, sameAsFirstRow],
        hasUniqueLabels: false,
      });
    });
  });

  describe('when called with SortOrder.Ascending', () => {
    it('then it should sort ascending', () => {
      const logsResult: LogsModel = {
        rows: [secondRow, firstRow, sameAsFirstRow],
        hasUniqueLabels: false,
      };
      const result = sortLogsResult(logsResult, SortOrder.Ascending);

      expect(result).toEqual({
        rows: [firstRow, sameAsFirstRow, secondRow],
        hasUniqueLabels: false,
      });
    });
  });

  describe('when buildQueryTransaction', () => {
    it('it should calculate interval based on time range', () => {
      const queries = [{ refId: 'A' }];
      const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
      const range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
      const transaction = buildQueryTransaction(queries, queryOptions, range, false);

      expect(transaction.request.intervalMs).toEqual(60000);
    });

    it('it should calculate interval taking minInterval into account', () => {
      const queries = [{ refId: 'A' }];
      const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
      const range = { from: dateTime().subtract(1, 'm'), to: dateTime(), raw: { from: '1h', to: '1h' } };
      const transaction = buildQueryTransaction(queries, queryOptions, range, false);

      expect(transaction.request.intervalMs).toEqual(15000);
    });

    it('it should calculate interval taking maxDataPoints into account', () => {
      const queries = [{ refId: 'A' }];
      const queryOptions = { maxDataPoints: 10, minInterval: '15s' };
      const range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
      const transaction = buildQueryTransaction(queries, queryOptions, range, false);

      expect(transaction.request.interval).toEqual('2h');
    });
  });
});
