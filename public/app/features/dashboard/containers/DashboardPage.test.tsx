import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { UnthemedDashboardPage, Props } from './DashboardPage';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { DashboardModel } from '../state';
import { configureStore } from '../../../store/configureStore';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { notifyApp } from 'app/core/actions';
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
  dashboard?: DashboardModel | null;
  container?: HTMLElement;
  mount: (propOverrides?: Partial<Props>) => void;
  unmount: () => void;
  props: Props;
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
          type: 'timeseries',
          title: 'My panel title',
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
      setup: (fn) => {
        setupFn = fn;
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
          initError: null,
          initDashboard: jest.fn(),
          notifyApp: mockToolkitActionCreator(notifyApp),
          cleanUpDashboardAndVariables: jest.fn(),
          cancelVariables: jest.fn(),
          templateVarsChangedInUrl: jest.fn(),
          dashboard: null,
          theme: createTheme(),
        };

        Object.assign(props, propOverrides);

        ctx.props = props;
        ctx.dashboard = props.dashboard;

        const { container, rerender, unmount } = render(
          <Provider store={store}>
            <Router history={locationService.getHistory()}>
              <UnthemedDashboardPage {...props} />
            </Router>
          </Provider>
        );

        ctx.container = container;

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
      props: {} as Props,
      rerender: () => {},
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

    it('Should call initDashboard on mount', () => {
      expect(ctx.props.initDashboard).toBeCalledWith({
        fixUrl: true,
        routeName: 'normal-dashboard',
        urlSlug: 'my-dash',
        urlUid: '11',
      });
      expect(ctx.container).toBeEmptyDOMElement();
    });
  });

  dashboardPageScenario('Given dashboard slow loading state', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({ isInitSlow: true });
    });

    it('Should show spinner', () => {
      expect(screen.getByText('Cancel loading dashboard')).toBeInTheDocument();
    });
  });

  dashboardPageScenario('Given a simple dashboard', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({ dashboard: getTestDashboard() });
    });

    it('Should render panels', () => {
      expect(screen.getByText('My panel title')).toBeInTheDocument();
    });

    it('Should update title', () => {
      expect(document.title).toBe('My dashboard - Grafana');
    });
  });

  dashboardPageScenario('When going into view mode', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        dashboard: getTestDashboard(),
        queryParams: { viewPanel: '1' },
      });
    });

    it('Should render panel in view mode', () => {
      expect(ctx.dashboard?.panelInView).toBeDefined();
      expect(ctx.dashboard?.panels[0].isViewing).toBe(true);
    });

    it('Should reset state when leaving', () => {
      ctx.rerender({ queryParams: {} });

      expect(ctx.dashboard?.panelInView).toBeUndefined();
      expect(ctx.dashboard?.panels[0].isViewing).toBe(false);
    });
  });

  dashboardPageScenario('When going into edit mode', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        dashboard: getTestDashboard(),
        queryParams: { editPanel: '1' },
      });
    });

    it('Should render panel in edit mode', () => {
      expect(ctx.dashboard?.panelInEdit).toBeDefined();
    });

    it('Should render panel editor', () => {
      expect(screen.getByTitle('Apply changes and go back to dashboard')).toBeInTheDocument();
    });

    it('Should reset state when leaving', () => {
      ctx.rerender({ queryParams: {} });
      expect(screen.queryByTitle('Apply changes and go back to dashboard')).not.toBeInTheDocument();
    });
  });

  dashboardPageScenario('When dashboard unmounts', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({ dashboard: getTestDashboard() });
      ctx.unmount();
    });

    it('Should call close action', () => {
      expect(ctx.props.cleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
    });
  });

  dashboardPageScenario('When dashboard changes', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.rerender({ dashboard: getTestDashboard() });
      ctx.rerender({
        match: {
          params: { uid: 'new-uid' },
        } as any,
        dashboard: getTestDashboard({ title: 'Another dashboard' }),
      });
    });

    it('Should call clean up action and init', () => {
      expect(ctx.props.cleanUpDashboardAndVariables).toHaveBeenCalledTimes(1);
      expect(ctx.props.initDashboard).toHaveBeenCalledTimes(2);
    });
  });

  dashboardPageScenario('No kiosk mode tv', (ctx) => {
    ctx.setup(() => {
      ctx.mount({ dashboard: getTestDashboard() });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should render dashboard page toolbar and submenu', () => {
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(1);
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(1);
    });
  });

  dashboardPageScenario('When in full kiosk mode', (ctx) => {
    ctx.setup(() => {
      ctx.mount({
        queryParams: { kiosk: true },
        dashboard: getTestDashboard(),
      });
      ctx.rerender({ dashboard: ctx.dashboard });
    });

    it('should not render page toolbar and submenu', () => {
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.DashNav.nav)).toHaveLength(0);
      expect(screen.queryAllByLabelText(selectors.pages.Dashboard.SubMenu.submenu)).toHaveLength(0);
    });
  });
});
