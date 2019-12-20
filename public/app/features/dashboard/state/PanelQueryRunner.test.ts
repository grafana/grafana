import { PanelQueryRunner } from './PanelQueryRunner';
import { PanelData, DataQueryRequest, dateTime, ScopedVars } from '@grafana/data';
import { DashboardModel } from './index';
import { setEchoSrv } from '@grafana/runtime';
import { Echo } from '../../../core/services/echo/Echo';

jest.mock('app/core/services/backend_srv');

const dashboardModel = new DashboardModel({
  panels: [{ id: 1, type: 'graph' }],
});

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => dashboardModel,
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
      runner: new PanelQueryRunner(),
      setup: (fn: () => void) => {
        setupFn = fn;
      },
    };

    const response: any = {
      data: [
        {
          target: 'hello',
          datapoints: [
            [1, 1000],
            [2, 2000],
          ],
        },
      ],
    };

    beforeEach(async () => {
      setEchoSrv(new Echo());
      setupFn();

      const datasource: any = {
        name: 'TestDB',
        interval: ctx.dsInterval,
        query: (options: DataQueryRequest) => {
          ctx.queryCalledWith = options;
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

      ctx.runner = new PanelQueryRunner();
      ctx.runner.getData().subscribe({
        next: (data: PanelData) => {
          ctx.res = data;
          ctx.events.push(data);
        },
      });

      ctx.events = [];
      ctx.runner.run(args);
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
});
