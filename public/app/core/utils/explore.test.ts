import { dateTime, ExploreUrlState, LogsSortOrder } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { RefreshPicker } from '@grafana/ui';
import store from 'app/core/store';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';

import { DatasourceSrvMock, MockDataSourceApi } from '../../../test/mocks/datasource_srv';

import {
  buildQueryTransaction,
  hasNonEmptyQuery,
  refreshIntervalToSortOrder,
  updateHistory,
  getExploreUrl,
  GetExploreUrlArguments,
  getTimeRange,
  generateEmptyQuery,
} from './explore';

const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  datasource: '',
  queries: [],
  range: DEFAULT_RANGE,
};

const defaultDs = new MockDataSourceApi('default datasource', { data: ['default data'] });

const datasourceSrv = new DatasourceSrvMock(defaultDs, {
  'generate empty query': new MockDataSourceApi('generateEmptyQuery'),
  ds1: {
    name: 'testDs',
    type: 'loki',
  } as MockDataSourceApi,
});

const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

describe('state functions', () => {
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
});

describe('getExploreUrl', () => {
  const args = {
    panel: {
      getSavedId: () => 1,
      targets: [
        { refId: 'A', expr: 'query1', legendFormat: 'legendFormat1' },
        { refId: 'B', expr: 'query2', datasource: { type: '__expr__', uid: '__expr__' } },
      ],
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
  it('should omit expression target in explore url', () => {
    expect(getExploreUrl(args).then((data) => expect(data).not.toMatch(/__expr__/g)));
  });
});

describe('updateHistory()', () => {
  const datasourceId = 'myDatasource';
  const key = `grafana.explore.history.${datasourceId}`;

  beforeEach(() => {
    store.delete(key);
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
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(60000);
  });
  it('it should calculate interval taking minInterval into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
    const range = { from: dateTime().subtract(1, 'm'), to: dateTime(), raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(15000);
  });
  it('it should calculate interval taking maxDataPoints into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 10, minInterval: '15s' };
    const range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.interval).toEqual('2h');
  });
});

describe('generateEmptyQuery', () => {
  it('should generate query with dataSourceOverride and without queries', async () => {
    const query = await generateEmptyQuery([], 1, { type: 'loki', uid: 'ds1' });

    expect(query.datasource?.uid).toBe('ds1');
    expect(query.datasource?.type).toBe('loki');
    expect(query.refId).toBe('A');
  });
  it('should generate query without dataSourceOverride and with queries', async () => {
    const query = await generateEmptyQuery(
      [
        {
          datasource: { type: 'loki', uid: 'ds1' },
          refId: 'A',
        },
      ],
      1
    );

    expect(query.datasource?.uid).toBe('ds1');
    expect(query.datasource?.type).toBe('loki');
    expect(query.refId).toBe('B');
  });

  it('should generate a query with a unique refId', async () => {
    const query = await generateEmptyQuery([{ refId: 'A' }], 2);

    expect(query.refId).not.toBe('A');
  });
});
