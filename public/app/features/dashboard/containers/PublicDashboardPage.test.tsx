import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { useEffectOnce } from 'react-use';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { locationService } from '@grafana/runtime';
import { Dashboard, DashboardCursorSync } from '@grafana/schema/src';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { DashboardInitPhase, DashboardMeta, DashboardRoutes } from 'app/types';
import * as appTypes from 'app/types';

import { SafeDynamicImport } from '../../../core/components/DynamicImports/SafeDynamicImport';
import { configureStore } from '../../../store/configureStore';
import { Props as LazyLoaderProps } from '../dashgrid/LazyLoader';
import { DashboardModel } from '../state';
import { initDashboard } from '../state/initDashboard';

import PublicDashboardPage, { Props } from './PublicDashboardPage';

jest.mock('app/features/dashboard/dashgrid/LazyLoader', () => {
  const LazyLoader = ({ children, onLoad }: Pick<LazyLoaderProps, 'children' | 'onLoad'>) => {
    useEffectOnce(() => {
      onLoad?.();
    });
    return <>{typeof children === 'function' ? children({ isInView: true }) : children}</>;
  };
  return { LazyLoader };
});

jest.mock('react-virtualized-auto-sizer', () => {
  //   //   // The size of the children need to be small enough to be outside the view.
  //   //   // So it does not trigger the query to be run by the PanelQueryRunner.
  return ({ children }: AutoSizerProps) => children({ height: 1, width: 1 });
});

jest.mock('app/features/dashboard/state/initDashboard', () => ({
  ...jest.requireActual('app/features/dashboard/state/initDashboard'),
  initDashboard: jest.fn(),
}));

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));

interface ScenarioContext {
  mount: () => void;
  rerender: ({
    propOverrides,
    newState,
  }: {
    propOverrides?: Partial<Props>;
    newState?: Partial<appTypes.StoreState>;
  }) => void;
  setup: (fn: () => void) => void;
}

const renderWithProvider = ({
  props,
  initialState,
}: {
  props: Props;
  initialState?: Partial<appTypes.StoreState>;
}): RenderResult => {
  const context = getGrafanaContextMock();
  const store = configureStore(initialState);

  return render(
    <GrafanaContext.Provider value={context}>
      <Provider store={store}>
        <Router history={locationService.getHistory()}>
          <PublicDashboardPage {...props} />
        </Router>
      </Provider>
    </GrafanaContext.Provider>
  );
};

const selectors = e2eSelectors.components;
const publicDashboardSelector = e2eSelectors.pages.PublicDashboard;

const getTestDashboard = (overrides?: Partial<Dashboard>, metaOverrides?: Partial<DashboardMeta>): DashboardModel => {
  const data: Dashboard = Object.assign(
    {
      title: 'My dashboard',
      revision: 1,
      editable: false,
      graphTooltip: DashboardCursorSync.Off,
      schemaVersion: 1,
      style: 'dark',
      timepicker: { hidden: true },
      timezone: '',
      panels: [
        {
          id: 1,
          type: 'timeseries',
          title: 'My panel title',
          gridPos: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
    },
    overrides
  );

  return new DashboardModel(data, metaOverrides);
};

function dashboardPageScenario(description: string, scenarioFn: (ctx: ScenarioContext) => void) {
  describe(description, () => {
    let setupFn: () => void;

    const ctx: ScenarioContext = {
      setup: (fn) => {
        setupFn = fn;
      },
      mount: () => {
        const props: Props = {
          ...getRouteComponentProps({
            match: { params: { accessToken: 'an-access-token' }, isExact: true, url: '', path: '' },
            route: {
              routeName: DashboardRoutes.Public,
              path: '/public-dashboards/:accessToken',
              component: SafeDynamicImport(
                () =>
                  import(
                    /* webpackChunkName: "PublicDashboardPage"*/ 'app/features/dashboard/containers/PublicDashboardPage'
                  )
              ),
            },
          }),
        };

        const { rerender } = renderWithProvider({ props });

        ctx.rerender = ({
          propsOverride,
          newState,
        }: {
          propsOverride?: Partial<Props>;
          newState?: Partial<appTypes.StoreState>;
        }) => {
          Object.assign(props, propsOverride);

          const context = getGrafanaContextMock();
          const store = configureStore(newState);

          rerender(
            <GrafanaContext.Provider value={context}>
              <Provider store={store}>
                <Router history={locationService.getHistory()}>
                  <PublicDashboardPage {...props} />
                </Router>
              </Provider>
            </GrafanaContext.Provider>
          );
        };
      },
      rerender: () => {},
    };

    beforeEach(() => {
      setupFn();
    });

    scenarioFn(ctx);
  });
}

describe('PublicDashboardPage', () => {
  dashboardPageScenario('Given initial state', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
    });

    it('Should call initDashboard on mount', () => {
      expect(initDashboard).toBeCalledWith({
        fixUrl: false,
        accessToken: 'an-access-token',
        routeName: 'public-dashboard',
        keybindingSrv: expect.anything(),
      });
    });
  });

  dashboardPageScenario('Given a simple public dashboard', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({
        newState: {
          dashboard: {
            getModel: getTestDashboard,
            initError: null,
            initPhase: DashboardInitPhase.Completed,
            permissions: [],
          },
        },
      });
    });

    it('Should render panels', () => {
      expect(screen.getByText('My panel title')).toBeInTheDocument();
    });

    it('Should update title', () => {
      expect(document.title).toBe('My dashboard - Grafana');
    });

    it('Should not render neither time range nor refresh picker buttons', () => {
      expect(screen.queryByTestId(selectors.TimePicker.openButton)).not.toBeInTheDocument();
      expect(screen.queryByTestId(selectors.RefreshPicker.runButtonV2)).not.toBeInTheDocument();
      expect(screen.queryByTestId(selectors.RefreshPicker.intervalButtonV2)).not.toBeInTheDocument();
    });

    it('Should not render paused or deleted screen', () => {
      expect(screen.queryByTestId(publicDashboardSelector.NotAvailable.container)).not.toBeInTheDocument();
    });
  });

  dashboardPageScenario('Given a public dashboard with time range enabled', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({
        newState: {
          dashboard: {
            getModel: () =>
              getTestDashboard({
                timepicker: { hidden: false, collapse: false, enable: true, refresh_intervals: [], time_options: [] },
              }),
            initError: null,
            initPhase: DashboardInitPhase.Completed,
            permissions: [],
          },
        },
      });
    });

    it('Should render time range and refresh picker buttons', () => {
      expect(screen.getByTestId(selectors.TimePicker.openButton)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.RefreshPicker.runButtonV2)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.RefreshPicker.intervalButtonV2)).toBeInTheDocument();
    });
  });

  dashboardPageScenario('Given paused public dashboard', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({
        newState: {
          dashboard: {
            getModel: () => getTestDashboard(undefined, { publicDashboardEnabled: false, dashboardNotFound: false }),
            initError: null,
            initPhase: DashboardInitPhase.Completed,
            permissions: [],
          },
        },
      });
    });

    it('Should render public dashboard paused screen', () => {
      expect(screen.queryByTestId(publicDashboardSelector.page)).not.toBeInTheDocument();

      expect(screen.getByTestId(publicDashboardSelector.NotAvailable.title)).toBeInTheDocument();
      expect(screen.getByTestId(publicDashboardSelector.NotAvailable.pausedDescription)).toBeInTheDocument();
    });
  });

  dashboardPageScenario('Given deleted public dashboard', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({
        newState: {
          dashboard: {
            getModel: () => getTestDashboard(undefined, { dashboardNotFound: true }),
            initError: null,
            initPhase: DashboardInitPhase.Completed,
            permissions: [],
          },
        },
      });
    });

    it('Should render public dashboard deleted screen', () => {
      expect(screen.queryByTestId(publicDashboardSelector.page)).not.toBeInTheDocument();

      expect(screen.getByTestId(publicDashboardSelector.NotAvailable.title)).toBeInTheDocument();
      expect(screen.queryByTestId(publicDashboardSelector.NotAvailable.pausedDescription)).not.toBeInTheDocument();
    });
  });
});
