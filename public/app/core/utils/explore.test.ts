import { dateTime, ExploreUrlState, LogsSortOrder } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { RefreshPicker } from '@grafana/ui';
import store from 'app/core/store';

import { ExploreId } from '../../types';

import {
  buildQueryTransaction,
  clearHistory,
  DEFAULT_RANGE,
  getRefIds,
  getValueWithRefId,
  hasNonEmptyQuery,
  parseUrlState,
  refreshIntervalToSortOrder,
  updateHistory,
  getExploreUrl,
  GetExploreUrlArguments,
  getTimeRangeFromUrl,
  getTimeRange,
} from './explore';

const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  datasource: '',
  queries: [],
  range: DEFAULT_RANGE,
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
      const paramValue = '{"datasource":"Local","queries":[{"expr":"metric"}],"range":{"from":"now-1h","to":"now"}}';
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
            refId: 'A',
          },
          {
            expr: 'super{foo="x/z"}',
            refId: 'B',
          },
        ],
        range: {
          from: 'now-5h',
          to: 'now',
        },
      };

      expect(serializeStateToUrlParam(state)).toBe(
        '{"datasource":"foo","queries":[{"expr":"metric{test=\\"a/b\\"}","refId":"A"},' +
          '{"expr":"super{foo=\\"x/z\\"}","refId":"B"}],"range":{"from":"now-5h","to":"now"}}'
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
            refId: 'A',
          },
          {
            expr: 'super{foo="x/z"}',
            refId: 'B',
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

    it('can parse serialized panelsState into the original state', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
            refId: 'A',
          },
          {
            expr: 'super{foo="x/z"}',
            refId: 'B',
          },
        ],
        range: {
          from: 'now - 5h',
          to: 'now',
        },
        panelsState: {
          trace: {
            spanId: 'abcdef',
          },
        },
      };
      const serialized = serializeStateToUrlParam(state);
      const parsed = parseUrlState(serialized);
      expect(state).toMatchObject(parsed);
    });
  });
});

describe('getExploreUrl', () => {
  const args = {
    panel: {
      getSavedId: () => 1,
      targets: [{ refId: 'A', expr: 'query1', legendFormat: 'legendFormat1' }],
    },
    datasourceSrv: {
      get() {
        return {
          getRef: jest.fn(),
        };
      },
      getDataSourceById: jest.fn(),
    },
    timeSrv: {
      timeRangeForUrl: () => '1',
    },
  } as unknown as GetExploreUrlArguments;

  it('should omit legendFormat in explore url', () => {
    expect(getExploreUrl(args).then((data) => expect(data).not.toMatch(/legendFormat1/g)));
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
    expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'panel', datasource: { uid: 'some-ds' } }])).toBeFalsy();
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

describe('getTimeRangeFromUrl', () => {
  it('should parse moment date', () => {
    // convert date strings to moment object
    const range = { from: dateTime('2020-10-22T10:44:33.615Z'), to: dateTime('2020-10-22T10:49:33.615Z') };
    const result = getTimeRangeFromUrl(range, 'browser', 0);
    expect(result.raw).toEqual(range);
  });

  it('should parse epoch strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').valueOf().toString(),
      to: dateTime('2020-10-22T11:00:00Z').valueOf().toString(),
    };
    const result = getTimeRangeFromUrl(range, 'browser', 0);
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
    const result = getTimeRangeFromUrl(range, 'browser', 0);
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });
});

describe('getTimeRange', () => {
  describe('should flip from and to when from is after to', () => {
    const rawRange = {
      from: 'now',
      to: 'now-6h',
    };

    const range = getTimeRange('utc', rawRange, 0);

    expect(range.from.isBefore(range.to)).toBe(true);
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

      expect(result).toBe(LogsSortOrder.Ascending);
    });
  });

  describe('when called with off option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(RefreshPicker.offOption.value);

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });

  describe('when called with 5s option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder('5s');

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });

  describe('when called with undefined', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(undefined);

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });
});

describe('when buildQueryTransaction', () => {
  it('it should calculate interval based on time range', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
    const range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(60000);
  });
  it('it should calculate interval taking minInterval into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
    const range = { from: dateTime().subtract(1, 'm'), to: dateTime(), raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(15000);
  });
  it('it should calculate interval taking maxDataPoints into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 10, minInterval: '15s' };
    const range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
    expect(transaction.request.interval).toEqual('2h');
  });
});
