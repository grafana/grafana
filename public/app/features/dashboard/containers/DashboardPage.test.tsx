import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { UnthemedDashboardPage, mapStateToProps, Props, State } from './DashboardPage';
import { DashboardModel } from '../state';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { notifyApp } from 'app/core/actions';
import { cleanUpDashboardAndVariables } from '../state/actions';
import { selectors } from '@grafana/e2e-selectors';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { getTheme } from '@grafana/ui';

jest.mock('app/features/dashboard/components/DashboardSettings/GeneralSettings', () => ({}));

interface ScenarioContext {
  cleanUpDashboardAndVariablesMock: typeof cleanUpDashboardAndVariables;
  dashboard?: DashboardModel | null;
  setDashboardProp: (overrides?: any, metaOverrides?: any) => void;
  wrapper?: ShallowWrapper<Props, State, UnthemedDashboardPage>;
  mount: (propOverrides?: Partial<Props>) => void;
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
        ctx.wrapper?.setProps({ dashboard: ctx.dashboard });
      },
      mount: (propOverrides?: Partial<Props>) => {
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
          theme: getTheme(),
        };

        Object.assign(props, propOverrides);

        ctx.dashboard = props.dashboard;
        ctx.wrapper = shallow(<UnthemedDashboardPage {...props} />);
      },
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
      ctx.wrapper?.setProps({
        isInitSlow: true,
        initPhase: DashboardInitPhase.Fetching,
      });
    });

    it('Should render slow init state', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('Dashboard init completed ', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
    });

    it('Should update title', () => {
      expect(document.title).toBe('My dashboard - Grafana');
    });

    it('Should render dashboard grid', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('When user goes into panel edit', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setProps({
        queryParams: { editPanel: '1' },
      });
    });

    it('Should update component state to fullscreen and edit', () => {
      const state = ctx.wrapper?.state();
      expect(state).not.toBe(null);
      expect(state?.editPanel).toBeDefined();
    });
  });

  dashboardPageScenario('When user goes into panel edit but has no edit permissions', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({}, { canEdit: false });
      ctx.wrapper?.setProps({
        queryParams: { editPanel: '1' },
      });
    });

    it('Should update component state to fullscreen and edit', () => {
      const state = ctx.wrapper?.state();
      expect(state?.editPanel).toBe(null);
    });
  });
  dashboardPageScenario('When user goes back to dashboard from edit panel', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setState({ scrollTop: 100 });
      ctx.wrapper?.setProps({
        queryParams: { editPanel: '1' },
      });
      ctx.wrapper?.setProps({
        queryParams: {},
      });
    });

    it('Should update model state normal state', () => {
      expect(ctx.dashboard).toBeDefined();
      // @ts-ignore typescript doesn't understand that dashboard must be defined to reach the row below
      expect(ctx.dashboard.panelInEdit).toBeUndefined();
    });

    it('Should update component state to normal and restore scrollTop', () => {
      const state = ctx.wrapper?.state();
      expect(ctx.wrapper).not.toBe(null);
      expect(state).not.toBe(null);
      expect(state?.editPanel).toBe(null);
      expect(state?.scrollTop).toBe(100);
    });
  });

  dashboardPageScenario('When dashboard has editview url state', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setProps({
        queryParams: { editview: 'settings' },
      });
    });

    it('should render settings view', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('When adding panel', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setState({ scrollTop: 100 });
      ctx.wrapper?.instance().onAddPanel();
    });

    it('should set scrollTop to 0', () => {
      expect(ctx.wrapper).not.toBe(null);
      expect(ctx.wrapper?.state()).not.toBe(null);
      expect(ctx.wrapper?.state().updateScrollTop).toBe(0);
    });

    it('should add panel widget to dashboard panels', () => {
      expect(ctx.dashboard).not.toBe(null);
      expect(ctx.dashboard?.panels[0].type).toBe('add-panel');
    });
  });

  dashboardPageScenario('Given panel with id 0', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.wrapper?.setProps({
        queryParams: { editPanel: '0' },
      });
    });

    it('Should go into edit mode', () => {
      const state = ctx.wrapper?.state();
      expect(ctx.wrapper).not.toBe(null);
      expect(state).not.toBe(null);
      expect(state?.editPanel).not.toBe(null);
    });
  });

  dashboardPageScenario('When dashboard unmounts', (ctx) => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.wrapper?.unmount();
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
    });

    it('should not render dashboard navigation ', () => {
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.DashNav.nav}"]`)).toHaveLength(1);
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.SubMenu.submenu}"]`)).toHaveLength(1);
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
    });

    it('should not render dashboard navigation ', () => {
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.DashNav.nav}"]`)).toHaveLength(1);
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.SubMenu.submenu}"]`)).toHaveLength(0);
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
    });

    it('should not render dashboard navigation and submenu', () => {
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.DashNav.nav}"]`)).toHaveLength(0);
      expect(ctx.wrapper?.find(`[aria-label="${selectors.pages.Dashboard.SubMenu.submenu}"]`)).toHaveLength(0);
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
