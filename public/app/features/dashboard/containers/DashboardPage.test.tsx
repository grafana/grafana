import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { UnthemedDashboardPage, mapStateToProps, Props } from './DashboardPage';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { DashboardModel } from '../state';
import { configureStore } from '../../../store/configureStore';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { notifyApp } from 'app/core/actions';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { selectors } from '@grafana/e2e-selectors';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { createTheme } from '@grafana/data';

jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', () => {
  class GeneralSettings extends React.Component<{}, {}> {
    render() {
      return <>general settings</>;
    }
  }

  return { GeneralSettings };
});

jest.mock('app/core/core', () => ({
  appEvents: {
    subscribe: () => {
      return { unsubscribe: () => {} };
    },
  },
}));

interface ScenarioContext {
  cleanUpDashboardAndVariablesMock: typeof cleanUpDashboardAndVariables;
  dashboard?: DashboardModel | null;
  setDashboardProp: (overrides?: any, metaOverrides?: any) => void;
  wrapper?: HTMLElement;
  mount: (propOverrides?: Partial<Props>) => void;
  unmount: () => void;
  rerender: (propOverrides?: Partial<Props>) => void;
  setup: (fn: () => void) => void;
}

function getTestDashboard(overrides?: any, metaOverrides?: any): DashboardModel {
  const data = Object.assign(
    {
      title: 'My dashboard',
      panels: [
        {
          id: 1,
          type: 'graph',
          title: 'My graph',
          gridPos: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
    },
    overrides
  );

  const meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
  return new DashboardModel(data, meta);
}

function dashboardPageScenario(description: string, scenarioFn: (ctx: ScenarioContext) => void) {
  describe(description, () => {
    let setupFn: () => void;

    const ctx: ScenarioContext = {
      cleanUpDashboardAndVariablesMock: jest.fn(),
      setup: (fn) => {
        setupFn = fn;
      },
      setDashboardProp: (overrides?: any, metaOverrides?: any) => {
        ctx.dashboard = getTestDashboard(overrides, metaOverrides);
      },
      mount: (propOverrides?: Partial<Props>) => {
        const store = configureStore();
        const props: Props = {
          ...getRouteComponentProps({
            match: { params: { slug: 'my-dash', uid: '11' } } as any,
            route: { routeName: DashboardRoutes.Normal } as any,
          }),
          initPhase: DashboardInitPhase.NotStarted,
          isInitSlow: false,
          initDashboard: jest.fn(),
          notifyApp: mockToolkitActionCreator(notifyApp),
          cleanUpDashboardAndVariables: ctx.cleanUpDashboardAndVariablesMock,
          cancelVariables: jest.fn(),
          templateVarsChangedInUrl: jest.fn(),
          dashboard: null,
          theme: createTheme(),
        };

        Object.assign(props, propOverrides);

        ctx.dashboard = props.dashboard;
        const { container, rerender, unmount } = render(
          <Provider store={store}>
            <Router history={locationService.getHistory()}>
              <UnthemedDashboardPage {...props} />
            </Router>
          </Provider>
        );
        ctx.wrapper = container;
        ctx.rerender = (newProps?: Partial<Props>) => {
          Object.assign(props, newProps);
          rerender(
            <Provider store={store}>
              <Router history={locationService.getHistory()}>
                <UnthemedDashboardPage {...props} />
              </Router>
            </Provider>
          );
        };
        ctx.unmount = unmount;
      },
      rerender: () => {
        // will be replaced while mount() is called
      },
      unmount: () => {},
    };

    beforeEach(() => {
      setupFn();
    });

    scenarioFn(ctx);
  });
}

describe('DashboardPage', () => {
  dashboardPageScenario('Given initial state', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
    });

    it('Should render nothing', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('Dashboard is fetching slowly', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        isInitSlow: true,
        initPhase: DashboardInitPhase.Fetching,
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('Should render slow init state', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('Dashboard init completed ', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        title: 'My dashboard - Grafana',
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('Should update title', () => {
      expect(screen.getByText('My dashboard - Grafana')).toBeInTheDocument();
    });

    it('Should render dashboard grid', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('When user goes back to dashboard from edit panel', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.setDashboardProp({ scrollTop: 100, queryParams: { editPanel: '1' } });
      ctx.setDashboardProp({
        queryParams: {},
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('Should update model state normal state', () => {
      expect(ctx.dashboard).toBeDefined();
      // @ts-ignore typescript doesn't understand that dashboard must be defined to reach the row below
      expect(ctx.dashboard.panelInEdit).toBeUndefined();
    });
  });

  dashboardPageScenario('When dashboard has editview url state', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        queryParams: { editview: 'settings' },
      });
      ctx.setDashboardProp();
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should render settings view', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('When dashboard unmounts', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.unmount();
    });

    it('Should call clean up action', () => {
      expect(ctx.cleanUpDashboardAndVariablesMock).toHaveBeenCalledTimes(1);
    });
  });

  dashboardPageScenario('Kiosk mode none', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        queryParams: {},
      });
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should not render dashboard navigation ', () => {
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(1);
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(1);
    });
  });

  dashboardPageScenario('Kiosk mode tv', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        queryParams: { kiosk: 'tv' },
      });
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should not render dashboard navigation ', () => {
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(1);
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(0);
    });
  });

  dashboardPageScenario('Kiosk mode full', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        queryParams: { kiosk: true },
      });
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should not render dashboard navigation and submenu', () => {
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(0);
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(0);
    });
  });

  describe('mapStateToProps', () => {
    const props = mapStateToProps({
      panelEditor: {},
      dashboard: {
        getModel: () => ({} as DashboardModel),
      },
    } as any);

    expect(props.dashboard).toBeDefined();
  });
});
