import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { initDashboard, InitDashboardArgs } from './initDashboard';
import { DashboardRouteInfo } from 'app/types';

const mockStore = configureMockStore([thunk]);

interface ScenarioContext {
  args: InitDashboardArgs;
  timeSrv: any;
  annotationsSrv: any;
  unsavedChangesSrv: any;
  variableSrv: any;
  dashboardSrv: any;
  keybindingSrv: any;
  setup: (fn: () => void) => void;
  actions: any[];
  storeState: any;
}

type ScenarioFn = (ctx: ScenarioContext) => void;

function describeInitScenario(description: string, scenarioFn: ScenarioFn) {
  describe(description, () => {
    const timeSrv = { init: jest.fn() };
    const annotationsSrv = { init: jest.fn() };
    const unsavedChangesSrv = { init: jest.fn() };
    const variableSrv = { init: jest.fn() };
    const dashboardSrv = { setCurrent: jest.fn() };
    const keybindingSrv = { setupDashboardBindings: jest.fn() };

    const injectorMock = {
      get: (name: string) => {
        switch (name) {
          case 'timeSrv':
            return timeSrv;
          case 'annotationsSrv':
            return annotationsSrv;
          case 'unsavedChangesSrv':
            return unsavedChangesSrv;
          case 'dashboardSrv':
            return dashboardSrv;
          case 'variableSrv':
            return variableSrv;
          case 'keybindingSrv':
            return keybindingSrv;
          default:
            throw { message: 'Unknown service ' + name };
        }
      },
    };

    let setupFn = () => {};

    const ctx: ScenarioContext = {
      args: {
        $injector: injectorMock,
        $scope: {},
        fixUrl: false,
        routeInfo: DashboardRouteInfo.Normal,
      },
      timeSrv,
      annotationsSrv,
      unsavedChangesSrv,
      variableSrv,
      dashboardSrv,
      keybindingSrv,
      actions: [],
      storeState: {
        location: {
          query: {},
        },
        user: {},
      },
      setup: (fn: () => void) => {
        setupFn = fn;
      },
    };

    beforeEach(async () => {
      setupFn();

      const store = mockStore(ctx.storeState);

      await store.dispatch(initDashboard(ctx.args));

      ctx.actions = store.getActions();
    });

    scenarioFn(ctx);
  });
}

describeInitScenario('Initializing new dashboard', ctx => {
  ctx.setup(() => {
    ctx.storeState.user.orgId = 12;
    ctx.args.routeInfo = DashboardRouteInfo.New;
  });

  it('Should send action to set loading state to fetching', () => {
    expect(ctx.actions[0].type).toBe('DASHBOARD_INIT_FETCHING');
  });

  it('Should send action to set loading state to Initializing', () => {
    expect(ctx.actions[1].type).toBe('DASHBOARD_INIT_SERVICES');
  });

  it('Should update location with orgId query param', () => {
    expect(ctx.actions[2].type).toBe('UPDATE_LOCATION');
    expect(ctx.actions[2].payload.query.orgId).toBe(12);
  });

  it('Should send action to set dashboard model', () => {
    expect(ctx.actions[3].type).toBe('DASHBOARD_INIT_COMLETED');
    expect(ctx.actions[3].payload.title).toBe('New dashboard');
  });

  it('Should Initializing services', () => {
    expect(ctx.timeSrv.init).toBeCalled();
    expect(ctx.annotationsSrv.init).toBeCalled();
    expect(ctx.variableSrv.init).toBeCalled();
    expect(ctx.unsavedChangesSrv.init).toBeCalled();
    expect(ctx.keybindingSrv.setupDashboardBindings).toBeCalled();
    expect(ctx.dashboardSrv.setCurrent).toBeCalled();
  });
});


