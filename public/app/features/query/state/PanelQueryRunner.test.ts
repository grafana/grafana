const applyFieldOverridesMock = jest.fn(); // needs to be first in this file

import { Subject } from 'rxjs';

// Importing this way to be able to spy on grafana/data

import * as grafanaData from '@grafana/data';
import { DataSourceApi, DataTransformerID, dateTime, TypedVariableModel } from '@grafana/data';
import { FrameType } from '@grafana/data/internal';
import { DataSourceSrv, setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import { Echo } from '../../../core/services/echo/Echo';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';

import {
  createDashboardQueryRunner,
  DashboardQueryRunnerFactoryArgs,
  setDashboardQueryRunnerFactory,
} from './DashboardQueryRunner/DashboardQueryRunner';
import { emptyResult } from './DashboardQueryRunner/utils';
import { PanelQueryRunner, QueryRunnerOptions } from './PanelQueryRunner';

jest.mock('@grafana/data', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/data'),
  applyFieldOverrides: applyFieldOverridesMock,
}));

jest.mock('app/core/services/backend_srv');
jest.mock('app/core/config', () => ({
  config: { featureToggles: { transformations: true } },
  getConfig: () => ({
    featureToggles: {},
  }),
}));

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

jest.mock('app/features/templating/template_srv', () => ({
  ...jest.requireActual('app/features/templating/template_srv'),
  getTemplateSrv: () =>
    new TemplateSrvMock([
      {
        name: 'server',
        type: 'datasource',
        current: { text: 'Server1', value: 'server' },
        options: [{ text: 'Server1', value: 'server1' }],
      },
      //multi value variable
      {
        name: 'multi',
        type: 'datasource',
        multi: true,
        current: { text: 'Server1,Server2', value: ['server-1', 'server-2'] },
        options: [
          { text: 'Server1', value: 'server1' },
          { text: 'Server2', value: 'server2' },
        ],
      },
    ] as TypedVariableModel[]),
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
const defaultPanelConfig: grafanaData.DataConfigSource = {
  getFieldOverrideOptions: () => undefined,
  getTransformations: () => undefined,
  getDataSupport: () => ({ annotations: false, alertStates: false }),
};

function describeQueryRunnerScenario(
  description: string,
  scenarioFn: ScenarioFn,
  panelConfig?: grafanaData.DataConfigSource
) {
  describe(description, () => {
    let setupFn = () => {};
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

    const response = {
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

    setDataSourceSrv({} as DataSourceSrv);
    setDashboardQueryRunnerFactory(() => ({
      getResult: emptyResult,
      run: () => undefined,
      cancel: () => undefined,
      cancellations: () => new Subject(),
      destroy: () => undefined,
    }));
    createDashboardQueryRunner({} as DashboardQueryRunnerFactoryArgs);

    beforeEach(async () => {
      setEchoSrv(new Echo());
      setupFn();

      const datasource = {
        name: 'TestDB',
        uid: 'TestDB-uid',
        interval: ctx.dsInterval,
        query: (options: grafanaData.DataQueryRequest) => {
          ctx.queryCalledWith = options;
          return Promise.resolve(response);
        },
        getRef: () => ({ type: 'test', uid: 'TestDB-uid' }),
        testDatasource: jest.fn(),
      } as unknown as DataSourceApi;

      const args = {
        datasource,
        scopedVars: ctx.scopedVars,
        minInterval: ctx.minInterval,
        maxDataPoints: ctx.maxDataPoints ?? Infinity,
        timeRange: {
          from: dateTime('2023-01-01T12:00:00Z'),
          to: dateTime('2023-01-02T12:00:00Z'),
          raw: { from: '1d', to: 'now' },
        },
        panelId: 1,
        panelName: 'PanelName',
        queries: [{ refId: 'A' }],
      } as QueryRunnerOptions;

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

    it('should set datasource uid on request', async () => {
      expect(ctx.queryCalledWith?.targets[0].datasource?.uid).toBe('TestDB-uid');
    });

    it('should pass scopedVars to datasource with interval props', async () => {
      expect(ctx.queryCalledWith?.scopedVars.server!.text).toBe('Server1');
      expect(ctx.queryCalledWith?.scopedVars.__interval!.text).toBe('5m');
      expect(ctx.queryCalledWith?.scopedVars.__interval_ms!.text).toBe('300000');
    });

    it('should pass the panel id and name', async () => {
      expect(ctx.queryCalledWith?.panelId).toBe(1);
      expect(ctx.queryCalledWith?.panelName).toBe('PanelName');
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
        theme: grafanaData.createTheme(),
      }),
      getTransformations: () => undefined,
      getDataSupport: () => ({ annotations: false, alertStates: false }),
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
      getTransformations: () => [{} as unknown as grafanaData.DataTransformerConfig],
      getDataSupport: () => ({ annotations: false, alertStates: false }),
    }
  );

  describeQueryRunnerScenario(
    'transformations',
    (ctx) => {
      it('should re-categorize any anno frames returned by series transformations', async () => {
        ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            // expect(data.series).toEqual([]);
            expect(data.annotations).toEqual([
              {
                name: 'exemplar',
                meta: { custom: { resultType: 'exemplar' }, dataTopic: 'annotations' },
                length: 2,
                fields: [
                  { config: {}, name: 'Time', type: 'time', values: [1000, 2000] },
                  { config: {}, name: 'Value', type: 'number', values: [1, 2] },
                ],
              },
            ]);
            return data;
          },
        });
      });
    },
    {
      getFieldOverrideOptions: () => undefined,
      getTransformations: () => [
        {
          id: DataTransformerID.convertFrameType,
          topic: grafanaData.DataTopic.Series,
          options: {
            targetType: FrameType.Exemplar,
          },
        },
      ],
      getDataSupport: () => ({ annotations: true, alertStates: false }),
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
        theme: grafanaData.createTheme(),
      }),
      // @ts-ignore
      getTransformations: () => [{} as unknown as grafanaData.DataTransformerConfig],
      getDataSupport: () => ({ annotations: false, alertStates: false }),
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
        theme: grafanaData.createTheme(),
      }),
      // @ts-ignore
      getTransformations: () => [{}],
      getDataSupport: () => ({ annotations: false, alertStates: false }),
    }
  );

  const snapshotData: grafanaData.DataFrameDTO[] = [
    {
      fields: [
        { name: 'time', type: grafanaData.FieldType.time, values: [1000] },
        { name: 'value', type: grafanaData.FieldType.number, values: [1] },
      ],
    },
  ];
  describeQueryRunnerScenario(
    'getData with snapshot data',
    (ctx) => {
      it('should return snapshotted data', async () => {
        ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
          next: (data: grafanaData.PanelData) => {
            expect(data.state).toBe(grafanaData.LoadingState.Done);
            expect(data.series).toEqual(snapshotData);
            expect(data.timeRange).toEqual(grafanaData.getDefaultTimeRange());
            return data;
          },
        });
      });
    },
    {
      ...defaultPanelConfig,
      snapshotData,
    }
  );

  describeQueryRunnerScenario(
    'shouldAddErrorwhenDatasourceVariableIsMultiple',
    (ctx) => {
      it('should add error when datasource variable is multiple and not repeated', async () => {
        // scopedVars is an object that represent the variables repeated in a panel
        const scopedVars = {
          server: { text: 'Server1', value: 'server-1' },
        };

        // We are spying on the replace method of the TemplateSrvMock to check if the custom format function is being called
        const spyReplace = jest.spyOn(TemplateSrvMock.prototype, 'replace');

        const response = {
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

        const datasource = {
          name: '${multi}',
          uid: '${multi}',
          interval: ctx.dsInterval,
          query: (options: grafanaData.DataQueryRequest) => {
            ctx.queryCalledWith = options;
            return Promise.resolve(response);
          },
          getRef: () => ({ type: 'test', uid: 'TestDB-uid' }),
          testDatasource: jest.fn(),
        } as unknown as DataSourceApi;

        ctx.runner.shouldAddErrorWhenDatasourceVariableIsMultiple(datasource, scopedVars);

        // the test is checking implementation details :(, but it is the only way to check if the error will be added
        // if the getTemplateSrv.replace is called with the custom format function,it means we will check
        // if the error should be added
        expect(spyReplace.mock.calls[0][2]).toBeInstanceOf(Function);
      });
    },
    {
      ...defaultPanelConfig,
    }
  );
});
