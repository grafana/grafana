import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { Subject } from 'rxjs';

import { FetchError, locationService, setEchoSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';
import { variableAdapters } from 'app/features/variables/adapters';
import { createConstantVariableAdapter } from 'app/features/variables/constant/adapter';
import { constantBuilder } from 'app/features/variables/shared/testing/builders';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';

import { Echo } from '../../../core/services/echo/Echo';
import {
  getDashboardQueryRunner,
  setDashboardQueryRunnerFactory,
} from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { emptyResult } from '../../query/state/DashboardQueryRunner/utils';
import { getPreloadedState } from '../../variables/state/helpers';
import { initialTransactionState, variablesInitTransaction } from '../../variables/state/transactionReducer';
import { TransactionStatus } from '../../variables/types';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from '../services/DashboardLoaderSrv';
import { getDashboardSrv, setDashboardSrv } from '../services/DashboardSrv';
import { getTimeSrv, setTimeSrv } from '../services/TimeSrv';

import { initDashboard, InitDashboardArgs } from './initDashboard';
import { dashboardInitCompleted, dashboardInitFetching, dashboardInitServices } from './reducers';

jest.mock('app/core/services/backend_srv');
jest.mock('app/features/dashboard/services/TimeSrv', () => {
  const original = jest.requireActual('app/features/dashboard/services/TimeSrv');
  return {
    ...original,
    getTimeSrv: () => ({
      ...original.getTimeSrv(),
      timeRange: jest.fn().mockReturnValue(undefined),
    }),
  };
});
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1, orgName: 'TestOrg' },
  },
}));
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getDataSourceSrv: jest.fn().mockImplementation(() => ({
      ...original.getDataSourceSrv(),
      getInstanceSettings: jest.fn(),
    })),
  };
});
jest.mock('@grafana/data', () => {
  const original = jest.requireActual('@grafana/data');
  return {
    ...original,
    EventBusSrv: jest.fn().mockImplementation(() => ({
      publish: jest.fn(),
    })),
  };
});

variableAdapters.register(createConstantVariableAdapter());
const mockStore = configureMockStore([thunk]);

interface ScenarioContext {
  args: InitDashboardArgs;
  loaderSrv: any;
  backendSrv: any;
  setup: (fn: () => void) => void;
  actions: any[];
  storeState: any;
}

type ScenarioFn = (ctx: ScenarioContext) => void;
const DASH_UID = 'DGmvKKxZz';
function describeInitScenario(description: string, scenarioFn: ScenarioFn) {
  describe(description, () => {
    const loaderSrv = {
      loadDashboard: jest.fn(() => ({
        meta: {
          canStar: false,
          canShare: false,
          isNew: true,
          folderId: 0,
        },
        dashboard: {
          title: 'My cool dashboard',
          panels: [
            {
              type: 'add-panel',
              gridPos: { x: 0, y: 0, w: 12, h: 9 },
              title: 'Panel Title',
              id: 2,
              targets: [
                {
                  datasource: {
                    type: 'grafana-azure-monitor-datasource',
                    uid: 'DSwithQueriesOnInitDashboard',
                    name: 'azMonitor',
                  },
                  queryType: 'Azure Log Analytics',
                  refId: 'A',
                  expr: 'old expr',
                },
                {
                  datasource: {
                    type: 'cloudwatch',
                    uid: '1234',
                    name: 'Cloud Watch',
                  },
                  refId: 'B',
                },
              ],
            },
            {
              collapsed: true,
              gridPos: {
                h: 1,
                w: 24,
                x: 0,
                y: 8,
              },
              id: 22,
              panels: [
                {
                  datasource: {
                    type: 'grafana-redshift-datasource',
                    uid: 'V6_lLJf7k',
                  },
                  gridPos: {
                    h: 8,
                    w: 12,
                    x: 12,
                    y: 9,
                  },
                  id: 8,
                  targets: [
                    {
                      datasource: {
                        type: 'grafana-redshift-datasource',
                        uid: 'V6_lLJf7k',
                      },
                      rawSQL: '',
                      refId: 'A',
                    },
                    {
                      datasource: {
                        type: 'grafana-azure-monitor-datasource',
                        uid: 'DSwithQueriesOnInitDashboard',
                        name: 'azMonitor',
                      },
                      queryType: 'Azure Monitor',
                      refId: 'B',
                    },
                  ],
                  title: 'Redshift and Azure',
                  type: 'stat',
                },
                {
                  id: 9,
                  type: 'text',
                },
              ],
              title: 'Collapsed Panel',
              type: 'row',
            },
          ],
          templating: {
            list: [constantBuilder().build()],
          },
          uid: DASH_UID,
        },
      })),
    };

    setDashboardLoaderSrv(loaderSrv as unknown as DashboardLoaderSrv);
    setDashboardQueryRunnerFactory(() => ({
      getResult: emptyResult,
      run: jest.fn(),
      cancel: () => undefined,
      cancellations: () => new Subject<any>(),
      destroy: () => undefined,
    }));

    let setupFn = () => {};

    const ctx: ScenarioContext = {
      args: {
        urlUid: DASH_UID,
        fixUrl: false,
        routeName: DashboardRoutes.Normal,
        keybindingSrv: {
          setupDashboardBindings: jest.fn(),
        } as unknown as KeybindingSrv,
      },
      backendSrv: getBackendSrv(),
      loaderSrv,
      actions: [],
      storeState: {
        location: {
          query: {},
        },
        dashboard: {
          initPhase: DashboardInitPhase.Services,
        },
        user: {},
        explore: {
          left: {
            queries: [],
          },
        },
        ...getPreloadedState(DASH_UID, {
          variables: {},
          transaction: { ...initialTransactionState, uid: DASH_UID, status: TransactionStatus.Completed },
        }),
      },
      setup: (fn: () => void) => {
        setupFn = fn;
      },
    };

    beforeEach(async () => {
      setDashboardSrv({
        setCurrent: jest.fn(),
      } as any);

      setTimeSrv({
        init: jest.fn(),
      } as any);

      setupFn();
      setEchoSrv(new Echo());

      const store = mockStore(ctx.storeState);
      // @ts-ignore
      await store.dispatch(initDashboard(ctx.args));

      ctx.actions = store.getActions();
    });

    scenarioFn(ctx);
  });
}

describeInitScenario('Initializing new dashboard', (ctx) => {
  ctx.setup(() => {
    ctx.storeState.user.orgId = 12;
    ctx.args.routeName = DashboardRoutes.New;
  });

  it('Should send action dashboardInitFetching', () => {
    expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
  });

  it('Should send action dashboardInitServices ', () => {
    expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
  });

  it('Should update location with orgId query param', () => {
    const search = locationService.getSearch();
    expect(search.get('orgId')).toBe('12');
  });

  it('Should send action dashboardInitCompleted', () => {
    expect(ctx.actions[7].type).toBe(dashboardInitCompleted.type);
    expect(ctx.actions[7].payload.title).toBe('New dashboard');
  });

  it('Should initialize services', () => {
    expect(getTimeSrv().init).toBeCalled();
    expect(getDashboardSrv().setCurrent).toBeCalled();
    expect(getDashboardQueryRunner().run).toBeCalled();
    expect(ctx.args.keybindingSrv.setupDashboardBindings).toBeCalled();
  });
});

describeInitScenario('Initializing home dashboard', (ctx) => {
  ctx.setup(() => {
    ctx.args.routeName = DashboardRoutes.Home;
    ctx.backendSrv.get.mockResolvedValue({
      redirectUri: '/u/123/my-home',
    });
  });

  it('Should redirect to custom home dashboard', () => {
    const location = locationService.getLocation();
    expect(location.pathname).toBe('/u/123/my-home');
  });
});

describeInitScenario('Initializing home dashboard cancelled', (ctx) => {
  ctx.setup(() => {
    ctx.args.routeName = DashboardRoutes.Home;
    const fetchError: FetchError = {
      cancelled: true,
      config: {
        url: '/api/dashboards/home',
      },
      data: 'foo',
      status: 500,
    };
    ctx.backendSrv.get.mockRejectedValue(fetchError);
  });

  it('Should abort init process', () => {
    expect(ctx.actions.length).toBe(1);
  });
});

describeInitScenario('Initializing existing dashboard', (ctx) => {
  const mockQueries = [
    {
      context: 'explore',
      key: 'jdasldsa98dsa9',
      refId: 'A',
      expr: 'new expr',
    },
    {
      context: 'explore',
      key: 'fdsjkfds78fd',
      refId: 'B',
    },
  ];

  ctx.setup(() => {
    ctx.storeState.user.orgId = 12;
    ctx.storeState.user.user = { id: 34 };
    ctx.storeState.explore.left.queries = mockQueries;
  });

  it('should send dashboard_loaded event', () => {
    expect(appEvents.publish).toHaveBeenCalledWith({
      payload: {
        queries: {
          cloudwatch: [
            {
              datasource: {
                name: 'Cloud Watch',
                type: 'cloudwatch',
                uid: '1234',
              },
              refId: 'B',
            },
          ],
          'grafana-azure-monitor-datasource': [
            {
              datasource: {
                name: 'azMonitor',
                type: 'grafana-azure-monitor-datasource',
                uid: 'DSwithQueriesOnInitDashboard',
              },
              expr: 'old expr',
              queryType: 'Azure Log Analytics',
              refId: 'A',
            },
            {
              datasource: {
                name: 'azMonitor',
                type: 'grafana-azure-monitor-datasource',
                uid: 'DSwithQueriesOnInitDashboard',
              },
              queryType: 'Azure Monitor',
              refId: 'B',
            },
          ],
          'grafana-redshift-datasource': [
            {
              datasource: {
                type: 'grafana-redshift-datasource',
                uid: 'V6_lLJf7k',
              },
              rawSQL: '',
              refId: 'A',
            },
          ],
        },
        dashboardId: 'DGmvKKxZz',
        orgId: 12,
        userId: 34,
        grafanaVersion: '1.0',
      },
      type: 'dashboard-loaded',
    });
  });

  it('Should send action dashboardInitFetching', () => {
    expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
  });

  it('Should send action dashboardInitServices ', () => {
    expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
  });

  it('Should update location with orgId query param', () => {
    const search = locationService.getSearch();
    expect(search.get('orgId')).toBe('12');
  });

  it('Should send action dashboardInitCompleted', () => {
    expect(ctx.actions[8].type).toBe(dashboardInitCompleted.type);
    expect(ctx.actions[8].payload.title).toBe('My cool dashboard');
  });

  it('Should initialize services', () => {
    expect(getTimeSrv().init).toBeCalled();
    expect(getDashboardSrv().setCurrent).toBeCalled();
    expect(getDashboardQueryRunner().run).toBeCalled();
    expect(ctx.args.keybindingSrv.setupDashboardBindings).toBeCalled();
  });

  it('Should initialize redux variables if newVariables is enabled', () => {
    expect(ctx.actions[2].payload.action.type).toBe(variablesInitTransaction.type);
  });
});

describeInitScenario('Initializing previously canceled dashboard initialization', (ctx) => {
  ctx.setup(() => {
    ctx.storeState.dashboard.initPhase = DashboardInitPhase.Fetching;
  });

  it('Should send action dashboardInitFetching', () => {
    expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
  });

  it('Should send action dashboardInitServices ', () => {
    expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
  });

  it('Should not send action dashboardInitCompleted', () => {
    const dashboardInitCompletedAction = ctx.actions.find((a) => {
      return a.type === dashboardInitCompleted.type;
    });
    expect(dashboardInitCompletedAction).toBe(undefined);
  });

  it('Should initialize timeSrv and dashboard query runner', () => {
    expect(getTimeSrv().init).toBeCalled();
    expect(getDashboardQueryRunner().run).toBeCalled();
  });
});

describeInitScenario('Initializing snapshot dashboard', (ctx) => {
  ctx.setup(() => {
    ctx.args.urlUid = undefined;
  });

  it('Should send action initVariablesTransaction with correct payload', () => {
    expect(ctx.actions[2].payload.action.type).toBe(variablesInitTransaction.type);
    expect(ctx.actions[2].payload.action.payload.uid).toBe(DASH_UID);
  });
});
