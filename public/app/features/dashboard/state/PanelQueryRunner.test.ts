import { PanelQueryRunner, QueryRunnerOptions } from './PanelQueryRunner';
import { PanelData, DataQueryRequest, DataStreamObserver, DataStreamState } from '@grafana/ui';

import { LoadingState, MutableDataFrame, ScopedVars } from '@grafana/data';
import { dateTime } from '@grafana/data';
import { SHARED_DASHBODARD_QUERY } from 'app/plugins/datasource/dashboard/SharedQueryRunner';
import { DashboardQuery } from 'app/plugins/datasource/dashboard/types';
import { PanelModel } from './PanelModel';
import { Subject } from 'rxjs';

jest.mock('app/core/services/backend_srv');

// Defined within setup functions
const panelsForCurrentDashboardMock: { [key: number]: PanelModel } = {};
jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => {
        return {
          getPanelById: (id: number) => {
            return panelsForCurrentDashboardMock[id];
          },
        };
      },
    };
  },
}));

interface ScenarioContext {
  setup: (fn: () => void) => void;

  // Options used in setup
  maxDataPoints?: number | null;
  widthPixels: number;
  dsInterval?: string;
  minInterval?: string;
  scopedVars: ScopedVars;

  // Filled in by the Scenario runner
  events?: PanelData[];
  res?: PanelData;
  queryCalledWith?: DataQueryRequest;
  observer: DataStreamObserver;
  runner: PanelQueryRunner;
}

type ScenarioFn = (ctx: ScenarioContext) => void;

function describeQueryRunnerScenario(description: string, scenarioFn: ScenarioFn) {
  describe(description, () => {
    let setupFn = () => {};

    const ctx: ScenarioContext = {
      widthPixels: 200,
      scopedVars: {
        server: { text: 'Server1', value: 'server-1' },
      },
      runner: new PanelQueryRunner(1),
      observer: (args: any) => {},
      setup: (fn: () => void) => {
        setupFn = fn;
      },
    };

    const response: any = {
      data: [{ target: 'hello', datapoints: [[1, 1000], [2, 2000]] }],
    };

    beforeEach(async () => {
      setupFn();

      const datasource: any = {
        name: 'TestDB',
        interval: ctx.dsInterval,
        query: (options: DataQueryRequest, observer: DataStreamObserver) => {
          ctx.queryCalledWith = options;
          ctx.observer = observer;
          return Promise.resolve(response);
        },
        testDatasource: jest.fn(),
      };

      const args: any = {
        datasource,
        scopedVars: ctx.scopedVars,
        minInterval: ctx.minInterval,
        widthPixels: ctx.widthPixels,
        maxDataPoints: ctx.maxDataPoints,
        timeRange: {
          from: dateTime().subtract(1, 'days'),
          to: dateTime(),
          raw: { from: '1h', to: 'now' },
        },
        panelId: 1,
        queries: [{ refId: 'A', test: 1 }],
      };

      ctx.runner = new PanelQueryRunner(1);
      ctx.runner.subscribe({
        next: (data: PanelData) => {
          ctx.events.push(data);
        },
      });

      panelsForCurrentDashboardMock[1] = {
        id: 1,
        getQueryRunner: () => {
          return ctx.runner;
        },
      } as PanelModel;

      ctx.events = [];
      ctx.res = await ctx.runner.run(args);
    });

    scenarioFn(ctx);
  });
}

describe('PanelQueryRunner', () => {
  describeQueryRunnerScenario('simple scenario', ctx => {
    it('should set requestId on request', async () => {
      expect(ctx.queryCalledWith.requestId).toBe('Q100');
    });

    it('should set datasource name on request', async () => {
      expect(ctx.queryCalledWith.targets[0].datasource).toBe('TestDB');
    });

    it('should pass scopedVars to datasource with interval props', async () => {
      expect(ctx.queryCalledWith.scopedVars.server.text).toBe('Server1');
      expect(ctx.queryCalledWith.scopedVars.__interval.text).toBe('5m');
      expect(ctx.queryCalledWith.scopedVars.__interval_ms.text).toBe('300000');
    });
  });

  describeQueryRunnerScenario('with no maxDataPoints or minInterval', ctx => {
    ctx.setup(() => {
      ctx.maxDataPoints = null;
      ctx.widthPixels = 200;
    });

    it('should return data', async () => {
      expect(ctx.res.error).toBeUndefined();
      expect(ctx.res.series.length).toBe(1);
    });

    it('should use widthPixels as maxDataPoints', async () => {
      expect(ctx.queryCalledWith.maxDataPoints).toBe(200);
    });

    it('should calculate interval based on width', async () => {
      expect(ctx.queryCalledWith.interval).toBe('5m');
    });

    it('fast query should only publish 1 data events', async () => {
      expect(ctx.events.length).toBe(1);
    });
  });

  describeQueryRunnerScenario('with no panel min interval but datasource min interval', ctx => {
    ctx.setup(() => {
      ctx.widthPixels = 20000;
      ctx.dsInterval = '15s';
    });

    it('should limit interval to data source min interval', async () => {
      expect(ctx.queryCalledWith.interval).toBe('15s');
    });
  });

  describeQueryRunnerScenario('with panel min interval and data source min interval', ctx => {
    ctx.setup(() => {
      ctx.widthPixels = 20000;
      ctx.dsInterval = '15s';
      ctx.minInterval = '30s';
    });

    it('should limit interval to panel min interval', async () => {
      expect(ctx.queryCalledWith.interval).toBe('30s');
    });
  });

  describeQueryRunnerScenario('with maxDataPoints', ctx => {
    ctx.setup(() => {
      ctx.maxDataPoints = 10;
    });

    it('should pass maxDataPoints if specified', async () => {
      expect(ctx.queryCalledWith.maxDataPoints).toBe(10);
    });
  });

  describeQueryRunnerScenario('when datasource is streaming data', ctx => {
    let streamState: DataStreamState;
    let isUnsubbed = false;

    beforeEach(() => {
      streamState = {
        state: LoadingState.Streaming,
        key: 'test-stream-1',
        data: [
          new MutableDataFrame({
            fields: [],
            name: 'I am a magic stream',
          }),
        ],
        request: {
          requestId: ctx.queryCalledWith.requestId,
        } as any,
        unsubscribe: () => {
          isUnsubbed = true;
        },
      };
      ctx.observer(streamState);
    });

    it('should push another update to subscriber', async () => {
      expect(ctx.events.length).toBe(2);
    });

    it('should set state to streaming', async () => {
      expect(ctx.events[1].state).toBe(LoadingState.Streaming);
    });

    it('should not unsubscribe', async () => {
      expect(isUnsubbed).toBe(false);
    });

    it('destroy should unsubscribe streams', async () => {
      ctx.runner.destroy();
      expect(isUnsubbed).toBe(true);
    });
  });

  describeQueryRunnerScenario('Shared query request', ctx => {
    ctx.setup(() => {});

    it('should get the same results as the original', async () => {
      // Get the results from
      const q: DashboardQuery = { refId: 'Z', panelId: 1 };
      const myPanelId = 7;

      const runnerWantingSharedResults = new PanelQueryRunner(myPanelId);
      panelsForCurrentDashboardMock[myPanelId] = {
        id: myPanelId,
        getQueryRunner: () => {
          return runnerWantingSharedResults;
        },
      } as PanelModel;

      const res = await runnerWantingSharedResults.run({
        datasource: SHARED_DASHBODARD_QUERY,
        queries: [q],

        // Same query setup
        scopedVars: ctx.scopedVars,
        minInterval: ctx.minInterval,
        widthPixels: ctx.widthPixels,
        maxDataPoints: ctx.maxDataPoints,
        timeRange: {
          from: dateTime().subtract(1, 'days'),
          to: dateTime(),
          raw: { from: '1h', to: 'now' },
        },
        panelId: myPanelId, // Not 1
      });

      const req = res.request;
      expect(req.panelId).toBe(1); // The source panel
      expect(req.targets[0].datasource).toBe('TestDB');
      expect(res.series.length).toBe(1);
      expect(res.series[0].length).toBe(2);

      // Get the private subject and check that someone is listening
      const subject = (ctx.runner as any).subject as Subject<PanelData>;
      expect(subject.observers.length).toBe(2);

      // Now change the query and we should stop listening
      try {
        runnerWantingSharedResults.run({
          datasource: 'unknown-datasource',
          panelId: myPanelId, // Not 1
        } as QueryRunnerOptions);
      } catch {}
      // runnerWantingSharedResults subject is now unsubscribed
      // the test listener is still subscribed
      expect(subject.observers.length).toBe(1);
    });
  });
});
