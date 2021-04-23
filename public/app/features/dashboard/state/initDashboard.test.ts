import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { initDashboard, InitDashboardArgs } from './initDashboard';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { dashboardInitCompleted, dashboardInitFetching, dashboardInitServices } from './reducers';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { Echo } from '../../../core/services/echo/Echo';
import { variableAdapters } from 'app/features/variables/adapters';
import { createConstantVariableAdapter } from 'app/features/variables/constant/adapter';
import { constantBuilder } from 'app/features/variables/shared/testing/builders';
import { TransactionStatus, variablesInitTransaction } from '../../variables/state/transactionReducer';
import { keybindingSrv } from 'app/core/services/keybindingSrv';
import { getTimeSrv, setTimeSrv } from '../services/TimeSrv';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from '../services/DashboardLoaderSrv';
import { getDashboardSrv, setDashboardSrv } from '../services/DashboardSrv';
import {
  getDashboardQueryRunner,
  setDashboardQueryRunnerFactory,
} from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { emptyResult } from '../../query/state/DashboardQueryRunner/utils';

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
jest.mock('app/features/dashboard/services/ChangeTracker');

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
                  refId: 'A',
                  expr: 'old expr',
                },
              ],
            },
          ],
          templating: {
            list: [constantBuilder().build()],
          },
        },
      })),
    };

    setDashboardLoaderSrv((loaderSrv as unknown) as DashboardLoaderSrv);
    setDashboardQueryRunnerFactory(() => ({
      getResult: emptyResult,
      run: jest.fn(),
      cancel: () => undefined,
      destroy: () => undefined,
    }));

    let setupFn = () => {};

    const ctx: ScenarioContext = {
      args: {
        urlUid: 'DGmvKKxZz',
        fixUrl: false,
        routeName: DashboardRoutes.Normal,
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
            originPanelId: undefined,
            queries: [],
          },
        },
        templating: {
          variables: {},
          transaction: { uid: 'DGmvKKxZz', status: TransactionStatus.Completed },
        },
      },
      setup: (fn: () => void) => {
        setupFn = fn;
      },
    };

    beforeEach(async () => {
      keybindingSrv.setupDashboardBindings = jest.fn();

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
    expect(keybindingSrv.setupDashboardBindings).toBeCalled();
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
    ctx.backendSrv.get.mockRejectedValue({ cancelled: true });
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
    ctx.storeState.explore.left.originPanelId = 2;
    ctx.storeState.explore.left.queries = mockQueries;
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
    expect(keybindingSrv.setupDashboardBindings).toBeCalled();
  });

  it('Should initialize redux variables if newVariables is enabled', () => {
    expect(ctx.actions[2].type).toBe(variablesInitTransaction.type);
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

  it('Should not initialize other services', () => {
    expect(getDashboardSrv().setCurrent).not.toBeCalled();
    expect(keybindingSrv.setupDashboardBindings).not.toBeCalled();
  });
});
