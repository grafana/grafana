const applyFieldOverridesMock = jest.fn(); // needs to be first in this file

// Importing this way to be able to spy on grafana/data
import * as grafanaData from '@grafana/data';
import { DashboardModel } from '../../dashboard/state/index';
import { setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { Echo } from '../../../core/services/echo/Echo';
import { emptyResult } from './DashboardQueryRunner/utils';
import {
  createDashboardQueryRunner,
  setDashboardQueryRunnerFactory,
} from './DashboardQueryRunner/DashboardQueryRunner';
import { PanelQueryRunner } from './PanelQueryRunner';

jest.mock('@grafana/data', () => ({
  __esModule: true,
  ...(jest.requireActual('@grafana/data') as any),
  applyFieldOverrides: applyFieldOverridesMock,
}));

jest.mock('app/core/services/backend_srv');
jest.mock('app/core/config', () => ({
  config: { featureToggles: { transformations: true } },
  getConfig: () => ({
    featureToggles: {},
  }),
}));

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
  dsInterval?: string;
  minInterval?: string;
  scopedVars: grafanaData.ScopedVars;

  // Filled in by the Scenario runner
  events?: grafanaData.PanelData[];
  res?: grafanaData.PanelData;
  queryCalledWith?: grafanaData.DataQueryRequest;
  runner: PanelQueryRunner;
}

type ScenarioFn = (ctx: ScenarioContext) => void;

function describeQueryRunnerScenario(
  description: string,
  scenarioFn: ScenarioFn,
  panelConfig?: grafanaData.DataConfigSource
) {
  describe(description, () => {
    let setupFn = () => {};
    const defaultPanelConfig: grafanaData.DataConfigSource = {
      getFieldOverrideOptions: () => undefined,
      getTransformations: () => undefined,
    };
    const ctx: ScenarioContext = {
      maxDataPoints: 200,
      scopedVars: {
        server: { text: 'Server1', value: 'server-1' },
      },
      runner: new PanelQueryRunner(panelConfig || defaultPanelConfig),
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

    setDataSourceSrv({} as any);
    setDashboardQueryRunnerFactory(() => ({
      getResult: emptyResult,
      run: () => undefined,
      cancel: () => undefined,
      destroy: () => undefined,
    }));
    createDashboardQueryRunner({} as any);

    beforeEach(async () => {
      setEchoSrv(new Echo());
      setupFn();

      const datasource: any = {
        name: 'TestDB',
        interval: ctx.dsInterval,
        query: (options: grafanaData.DataQueryRequest) => {
          ctx.queryCalledWith = options;
          return Promise.resolve(response);
        },
        testDatasource: jest.fn(),
      };

      const args: any = {
        datasource,
        scopedVars: ctx.scopedVars,
        minInterval: ctx.minInterval,
        maxDataPoints: ctx.maxDataPoints,
        timeRange: {
          from: grafanaData.dateTime().subtract(1, 'days'),
          to: grafanaData.dateTime(),
          raw: { from: '1d', to: 'now' },
        },
        panelId: 1,
        queries: [{ refId: 'A', test: 1 }],
      };

      ctx.runner = new PanelQueryRunner(panelConfig || defaultPanelConfig);
      ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
        next: (data: grafanaData.PanelData) => {
          ctx.res = data;
          ctx.events?.push(data);
        },
      });

      ctx.events = [];
      ctx.runner.run(args);
    });

    scenarioFn(ctx);
  });
}

describe('PanelQueryRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describeQueryRunnerScenario('simple scenario', (ctx) => {
    it('should set requestId on request', async () => {
      expect(ctx.queryCalledWith?.requestId).toBe('Q100');
    });

    it('should set datasource name on request', async () => {
      expect(ctx.queryCalledWith?.targets[0].datasource).toBe('TestDB');
    });

    it('should pass scopedVars to datasource with interval props', async () => {
      expect(ctx.queryCalledWith?.scopedVars.server.text).toBe('Server1');
      expect(ctx.queryCalledWith?.scopedVars.__interval.text).toBe('5m');
      expect(ctx.queryCalledWith?.scopedVars.__interval_ms.text).toBe('300000');
    });
  });

  describeQueryRunnerScenario('with maxDataPoints', (ctx) => {
    ctx.setup(() => {
      ctx.maxDataPoints = 200;
    });

    it('should return data', async () => {
      expect(ctx.res?.error).toBeUndefined();
      expect(ctx.res?.series.length).toBe(1);
    });

    it('should use widthPixels as maxDataPoints', async () => {
      expect(ctx.queryCalledWith?.maxDataPoints).toBe(200);
    });

    it('should calculate interval based on width', async () => {
      expect(ctx.queryCalledWith?.interval).toBe('5m');
    });

    it('fast query should only publish 1 data events', async () => {
      expect(ctx.events?.length).toBe(1);
    });
  });

  describeQueryRunnerScenario('with no panel min interval but datasource min interval', (ctx) => {
    ctx.setup(() => {
      ctx.maxDataPoints = 20000;
      ctx.dsInterval = '15s';
    });

    it('should limit interval to data source min interval', async () => {
      expect(ctx.queryCalledWith?.interval).toBe('15s');
    });
  });

  describeQueryRunnerScenario('with panel min interval and data source min interval', (ctx) => {
    ctx.setup(() => {
      ctx.maxDataPoints = 20000;
      ctx.dsInterval = '15s';
      ctx.minInterval = '30s';
    });

    it('should limit interval to panel min interval', async () => {
      expect(ctx.queryCalledWith?.interval).toBe('30s');
    });
  });

  describeQueryRunnerScenario('with maxDataPoints', (ctx) => {
    ctx.setup(() => {
      ctx.maxDataPoints = 10;
    });

    it('should pass maxDataPoints if specified', async () => {
      expect(ctx.queryCalledWith?.maxDataPoints).toBe(10);
    });

    it('should use instead of width to calculate interval', async () => {
      expect(ctx.queryCalledWith?.interval).toBe('2h');
    });
  });

  describeQueryRunnerScenario(
    'field overrides',
    (ctx) => {
      it('should apply when field override options are set', async () => {
        ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });
        expect(applyFieldOverridesMock).toBeCalled();
      });
    },
    {
      getFieldOverrideOptions: () => ({
        fieldConfig: {
          defaults: {
            unit: 'm/s',
          },
          // @ts-ignore
          overrides: [],
        },
        replaceVariables: (v) => v,
        theme: {} as grafanaData.GrafanaTheme,
      }),
      getTransformations: () => undefined,
    }
  );

  describeQueryRunnerScenario(
    'transformations',
    (ctx) => {
      it('should apply when transformations are set', async () => {
        const spy = jest.spyOn(grafanaData, 'transformDataFrame');
        spy.mockClear();

        ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });

        expect(spy).toBeCalled();
      });
    },
    {
      getFieldOverrideOptions: () => undefined,
      // @ts-ignore
      getTransformations: () => [({} as unknown) as grafanaData.DataTransformerConfig],
    }
  );

  describeQueryRunnerScenario(
    'getData',
    (ctx) => {
      it('should not apply transformations when transform option is false', async () => {
        const spy = jest.spyOn(grafanaData, 'transformDataFrame');
        spy.mockClear();
        ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });

        expect(spy).not.toBeCalled();
      });

      it('should not apply field config when applyFieldConfig option is false', async () => {
        ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });

        expect(applyFieldOverridesMock).not.toBeCalled();
      });
    },
    {
      getFieldOverrideOptions: () => ({
        fieldConfig: {
          defaults: {
            unit: 'm/s',
          },
          // @ts-ignore
          overrides: [],
        },
        replaceVariables: (v) => v,
        theme: {} as grafanaData.GrafanaTheme,
      }),
      // @ts-ignore
      getTransformations: () => [({} as unknown) as grafanaData.DataTransformerConfig],
    }
  );

  describeQueryRunnerScenario(
    'getData',
    (ctx) => {
      it('should not apply transformations when transform option is false', async () => {
        const spy = jest.spyOn(grafanaData, 'transformDataFrame');
        spy.mockClear();
        ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });

        expect(spy).not.toBeCalled();
      });

      it('should not apply field config when applyFieldConfig option is false', async () => {
        ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            return data;
          },
        });

        expect(applyFieldOverridesMock).not.toBeCalled();
      });
    },
    {
      getFieldOverrideOptions: () => ({
        fieldConfig: {
          defaults: {
            unit: 'm/s',
          },
          // @ts-ignore
          overrides: [],
        },
        replaceVariables: (v) => v,
        theme: {} as grafanaData.GrafanaTheme,
      }),
      // @ts-ignore
      getTransformations: () => [{}],
    }
  );
});
