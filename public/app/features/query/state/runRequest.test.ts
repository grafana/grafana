import { Observable, Subscriber, Subscription } from 'rxjs';

import {
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataTopic,
  dateTime,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { setEchoSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DataQuery } from '@grafana/schema';

import { deepFreeze } from '../../../../test/core/redux/reducerTester';
import { Echo } from '../../../core/services/echo/Echo';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';

import { getMockDataSource, TestQuery } from './mocks/mockDataSource';
import { callQueryMethodWithMigration, runRequest } from './runRequest';

jest.mock('app/core/services/backend_srv');

const dashboardModel = createDashboardModelFixture({
  panels: [{ id: 1, type: 'graph' }],
});

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => dashboardModel,
    };
  },
}));

jest.mock('app/features/expressions/ExpressionDatasource', () => ({
  dataSource: {
    query: jest.fn(),
  },
}));

let isMigrationHandlerMock = jest.fn().mockReturnValue(false);
let migrateRequestMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isMigrationHandler: () => isMigrationHandlerMock(),
  migrateRequest: () => migrateRequestMock(),
}));

class ScenarioCtx {
  ds!: DataSourceApi;
  request!: DataQueryRequest;
  subscriber!: Subscriber<DataQueryResponse>;
  isUnsubbed = false;
  setupFn: () => void = () => {};
  results!: PanelData[];
  subscription!: Subscription;
  wasStarted = false;
  error: Error | null = null;
  toStartTime = dateTime();
  fromStartTime = dateTime();

  reset() {
    this.wasStarted = false;
    this.isUnsubbed = false;

    this.results = [];
    this.request = {
      range: {
        from: this.fromStartTime,
        to: this.toStartTime,
        raw: { from: '1h', to: 'now' },
      },
      targets: [
        {
          refId: 'A',
        },
      ],
    } as DataQueryRequest;

    this.ds = {
      query: (request: DataQueryRequest) => {
        return new Observable<DataQueryResponse>((subscriber) => {
          this.subscriber = subscriber;
          this.wasStarted = true;

          if (this.error) {
            throw this.error;
          }

          return () => {
            this.isUnsubbed = true;
          };
        });
      },
    } as DataSourceApi;
  }

  start() {
    this.subscription = runRequest(this.ds, this.request).subscribe({
      next: (data: PanelData) => {
        this.results.push(data);
      },
    });
  }

  emitPacket(packet: DataQueryResponse) {
    this.subscriber.next(packet);
  }

  setup(fn: () => void) {
    this.setupFn = fn;
  }
}

function runRequestScenario(desc: string, fn: (ctx: ScenarioCtx) => void) {
  describe(desc, () => {
    const ctx = new ScenarioCtx();

    beforeEach(() => {
      setEchoSrv(new Echo());
      ctx.reset();
      return ctx.setupFn();
    });

    fn(ctx);
  });
}

function runRequestScenarioThatThrows(desc: string, fn: (ctx: ScenarioCtx) => void) {
  describe(desc, () => {
    const ctx = new ScenarioCtx();
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      setEchoSrv(new Echo());
      ctx.reset();
      return ctx.setupFn();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    fn(ctx);
  });
}

describe('runRequest', () => {
  runRequestScenario('with no queries', (ctx) => {
    ctx.setup(() => {
      ctx.request.targets = [];
      ctx.start();
    });

    it('should emit empty result with loading state done', () => {
      expect(ctx.wasStarted).toBe(false);
      expect(ctx.results[0].state).toBe(LoadingState.Done);
    });
  });

  runRequestScenario('After first response', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'Data' } as DataFrame],
      });
    });

    it('should emit single result with loading state done', () => {
      expect(ctx.wasStarted).toBe(true);
      expect(ctx.results.length).toBe(1);
    });
  });

  runRequestScenario('After three responses, 2 with different keys', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataB-1' } as DataFrame],
        key: 'B',
      });
    });

    it('should emit 3 separate results', () => {
      expect(ctx.results.length).toBe(3);
    });

    it('should combine results and return latest data for key A', () => {
      expect(ctx.results[2].series).toEqual([{ name: 'DataA-2' }, { name: 'DataB-1' }]);
    });

    it('should have loading state Done', () => {
      expect(ctx.results[2].state).toEqual(LoadingState.Done);
    });
  });

  runRequestScenario('When the key is defined in refId', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataX-1', refId: 'X' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'DataY-1', refId: 'Y' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'DataY-2', refId: 'Y' } as DataFrame],
      });
    });

    it('should emit 3 separate results', () => {
      expect(ctx.results.length).toBe(3);
    });

    it('should keep data for X and Y', () => {
      expect(ctx.results[2].series).toMatchInlineSnapshot(`
        [
          {
            "name": "DataX-1",
            "refId": "X",
          },
          {
            "name": "DataY-2",
            "refId": "Y",
          },
        ]
      `);
    });
  });

  runRequestScenario('When the response contains traceIds', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'data-a', refId: 'A' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'data-b', refId: 'B' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'data-c', refId: 'C' } as DataFrame],
        traceIds: ['t1', 't2'],
      });
      ctx.emitPacket({
        data: [{ name: 'data-d', refId: 'D' } as DataFrame],
      });
      ctx.emitPacket({
        data: [{ name: 'data-e', refId: 'E' } as DataFrame],
        traceIds: ['t3', 't4'],
      });
      ctx.emitPacket({
        data: [{ name: 'data-e', refId: 'E' } as DataFrame],
        traceIds: ['t4', 't4'],
      });
    });
    it('should collect traceIds correctly', () => {
      const { results } = ctx;
      expect(results).toHaveLength(6);
      expect(results[0].traceIds).toBeUndefined();

      // this is the result of adding no-traces data to no-traces state
      expect(results[1].traceIds).toBeUndefined();
      // this is the result of adding with-traces data to no-traces state
      expect(results[2].traceIds).toStrictEqual(['t1', 't2']);
      // this is the result of adding no-traces data to with-traces state
      expect(results[3].traceIds).toStrictEqual(['t1', 't2']);
      // this is the result of adding with-traces data to with-traces state
      expect(results[4].traceIds).toStrictEqual(['t1', 't2', 't3', 't4']);
      // this is the result of adding with-traces data to with-traces state with duplicate traceIds
      expect(results[5].traceIds).toStrictEqual(['t1', 't2', 't3', 't4']);
    });
  });

  runRequestScenario('After response with state Streaming', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2' } as DataFrame],
        key: 'A',
        state: LoadingState.Streaming,
      });
    });

    it('should have loading state Streaming', () => {
      expect(ctx.results[1].state).toEqual(LoadingState.Streaming);
    });
  });

  runRequestScenario('If no response after 250ms', (ctx) => {
    ctx.setup(async () => {
      ctx.start();
      await sleep(250);
    });

    it('should emit 1 result with loading state', () => {
      expect(ctx.results.length).toBe(1);
      expect(ctx.results[0].state).toBe(LoadingState.Loading);
    });
  });

  runRequestScenarioThatThrows('on thrown error', (ctx) => {
    ctx.setup(() => {
      ctx.error = new Error('Ohh no');
      ctx.start();
    });

    it('should emit 1 error result', () => {
      expect(ctx.results[0].error?.message).toBe('Ohh no');
      expect(ctx.results[0].state).toBe(LoadingState.Error);
    });
  });

  runRequestScenario('If time range is relative', (ctx) => {
    ctx.setup(async () => {
      // any changes to ctx.request.range will throw and state would become LoadingState.Error
      deepFreeze(ctx.request.range);
      ctx.start();

      // wait a bit
      await sleep(20);

      ctx.emitPacket({ data: [{ name: 'DataB-1' } as DataFrame], state: LoadingState.Streaming });
    });

    it('should add the correct timeRange property and the request range should not be mutated', () => {
      expect(ctx.results[0].timeRange.to.valueOf()).toBeDefined();
      expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.toStartTime.valueOf());
      expect(ctx.results[0].timeRange.to.valueOf()).not.toBe(ctx.results[0].request?.range?.to.valueOf());

      expectThatRangeHasNotMutated(ctx);
    });
  });

  runRequestScenario('If time range is not relative', (ctx) => {
    ctx.setup(async () => {
      ctx.request.range!.raw.from = ctx.fromStartTime;
      ctx.request.range!.raw.to = ctx.toStartTime;
      // any changes to ctx.request.range will throw and state would become LoadingState.Error
      deepFreeze(ctx.request.range);
      ctx.start();

      // wait a bit
      await sleep(20);

      ctx.emitPacket({ data: [{ name: 'DataB-1' } as DataFrame] });
    });

    it('should add the correct timeRange property and the request range should not be mutated', () => {
      expect(ctx.results[0].timeRange).toBeDefined();
      expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.toStartTime.valueOf());
      expect(ctx.results[0].timeRange.to.valueOf()).toBe(ctx.results[0].request?.range?.to.valueOf());

      expectThatRangeHasNotMutated(ctx);
    });
  });

  runRequestScenario('With annotations dataTopic', (ctx) => {
    ctx.setup(() => {
      ctx.start();
      ctx.emitPacket({
        data: [{ name: 'DataA-1' } as DataFrame],
        key: 'A',
      });
      ctx.emitPacket({
        data: [{ name: 'DataA-2', meta: { dataTopic: DataTopic.Annotations } } as DataFrame],
        key: 'B',
      });
    });

    it('should separate annotations results', () => {
      expect(ctx.results[1].annotations?.length).toBe(1);
      expect(ctx.results[1].series.length).toBe(1);
    });
  });

  runRequestScenario('When some queries are hidden', (ctx) => {
    ctx.setup(() => {
      ctx.request.targets = [{ refId: 'A', hide: true }, { refId: 'B' }];
      ctx.start();
      ctx.emitPacket({
        data: [
          { name: 'DataA-1', refId: 'A' },
          { name: 'DataA-2', refId: 'A' },
          { name: 'DataB-1', refId: 'B' },
          { name: 'DataB-2', refId: 'B' },
        ],
        key: 'A',
      });
    });

    it('should filter out responses that are associated with the hidden queries', () => {
      expect(ctx.results[0].series.length).toBe(2);
      expect(ctx.results[0].series[0].name).toBe('DataB-1');
      expect(ctx.results[0].series[1].name).toBe('DataB-2');
    });
  });
});

describe('callQueryMethodWithMigration', () => {
  let request: DataQueryRequest<TestQuery>;
  let filterQuerySpy: jest.SpyInstance;
  let querySpy: jest.SpyInstance;
  let defaultQuerySpy: jest.SpyInstance;
  let ds: DataSourceApi;

  const setup = ({
    targets,
    filterQuery,
    getDefaultQuery,
    queryFunction,
    migrateRequest,
  }: {
    targets: TestQuery[];
    getDefaultQuery?: (app: CoreApp) => Partial<TestQuery>;
    filterQuery?: typeof ds.filterQuery;
    queryFunction?: typeof ds.query;
    migrateRequest?: jest.Mock;
  }) => {
    request = {
      range: {
        from: dateTime(),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
      },
      targets,
      requestId: '',
      interval: '',
      intervalMs: 0,
      scopedVars: {},
      timezone: '',
      app: '',
      startTime: 0,
    };

    const ds = getMockDataSource();
    if (filterQuery) {
      ds.filterQuery = filterQuery;
      filterQuerySpy = jest.spyOn(ds, 'filterQuery');
    }
    if (getDefaultQuery) {
      ds.getDefaultQuery = getDefaultQuery;
      defaultQuerySpy = jest.spyOn(ds, 'getDefaultQuery');
    }
    if (migrateRequest) {
      isMigrationHandlerMock = jest.fn().mockReturnValue(true);
      migrateRequestMock = migrateRequest;
    }
    querySpy = jest.spyOn(ds, 'query');
    return callQueryMethodWithMigration(ds, request, queryFunction);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should call filterQuery and exclude them from the request', async () => {
    setup({
      targets: [
        {
          refId: 'A',
          q: 'SUM(foo)',
        },
        {
          refId: 'B',
          q: 'SUM(foo2)',
        },
        {
          refId: 'C',
          q: 'SUM(foo3)',
        },
      ],
      filterQuery: (query: DataQuery) => query.refId !== 'A',
    });
    expect(filterQuerySpy).toHaveBeenCalledTimes(3);
    expect(querySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          { q: 'SUM(foo2)', refId: 'B' },
          { q: 'SUM(foo3)', refId: 'C' },
        ],
      })
    );
  });

  it('Should not call query function in case targets are empty', async () => {
    setup({
      targets: [
        {
          refId: 'A',
          q: 'SUM(foo)',
        },
        {
          refId: 'B',
          q: 'SUM(foo2)',
        },
        {
          refId: 'C',
          q: 'SUM(foo3)',
        },
      ],
      filterQuery: (_: DataQuery) => false,
    });
    expect(filterQuerySpy).toHaveBeenCalledTimes(3);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('Should not call filterQuery in case a custom query method is provided', async () => {
    const queryFunctionMock = jest.fn().mockResolvedValue({ data: [] });
    setup({
      targets: [
        {
          refId: 'A',
          q: 'SUM(foo)',
        },
        {
          refId: 'B',
          q: 'SUM(foo2)',
        },
        {
          refId: 'C',
          q: 'SUM(foo3)',
        },
      ],
      queryFunction: queryFunctionMock,
      filterQuery: (query: DataQuery) => query.refId !== 'A',
    });
    expect(filterQuerySpy).not.toHaveBeenCalled();
    expect(queryFunctionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          { q: 'SUM(foo)', refId: 'A' },
          { q: 'SUM(foo2)', refId: 'B' },
          { q: 'SUM(foo3)', refId: 'C' },
        ],
      })
    );
  });

  it('Should not call filterQuery when targets include expression query', async () => {
    setup({
      targets: [
        {
          refId: 'A',
          q: 'SUM(foo)',
        },
        {
          refId: 'B',
          q: 'SUM(foo2)',
        },
        {
          datasource: ExpressionDatasourceRef,
          refId: 'C',
          q: 'SUM(foo3)',
        },
      ],
      filterQuery: (query: DataQuery) => query.refId !== 'A',
    });
    expect(filterQuerySpy).not.toHaveBeenCalled();
  });

  it('Should get ds default query when query is empty', async () => {
    setup({
      targets: [
        {
          refId: 'A',
        },
        {
          refId: 'B',
        },
        {
          refId: 'C',
          q: 'SUM(foo3)',
        },
      ],
      getDefaultQuery: (_: CoreApp) => ({
        q: 'SUM(foo2)',
      }),
    });
    expect(defaultQuerySpy).toHaveBeenCalledTimes(2);
    expect(querySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          { q: 'SUM(foo2)', refId: 'A' },
          { q: 'SUM(foo2)', refId: 'B' },
          { q: 'SUM(foo3)', refId: 'C' },
        ],
      })
    );
  });

  it('Should migrate a request if defined', (done) => {
    const migrateRequest = jest.fn();
    const res = setup({
      targets: [
        {
          refId: 'A',
          q: 'SUM(foo)',
        },
      ],
      migrateRequest: migrateRequest.mockResolvedValue({
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: '1h', to: 'now' },
        },
        targets: [
          {
            refId: 'A',
            qMigrated: 'SUM(foo)',
          },
        ],
        requestId: '',
        interval: '',
        intervalMs: 0,
        scopedVars: {},
        timezone: '',
        app: '',
        startTime: 0,
      }),
    });
    expect(migrateRequest).toHaveBeenCalledTimes(1);
    res.subscribe((res) => {
      expect(res).toBeDefined();
      expect(querySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: [{ qMigrated: 'SUM(foo)', refId: 'A' }],
        })
      );
      done();
    });
  });
});

const expectThatRangeHasNotMutated = (ctx: ScenarioCtx) => {
  // Make sure that the range for request is not changed and that deepfreeze hasn't thrown
  expect(ctx.results[0].request?.range?.to.valueOf()).toBe(ctx.toStartTime.valueOf());
  expect(ctx.results[0].error).not.toBeDefined();
};

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
