import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { DashboardPage, mapStateToProps, Props, State } from './DashboardPage';
import { DashboardModel } from '../state';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRouteInfo } from 'app/types';
import { notifyApp, updateLocation } from 'app/core/actions';
import { cleanUpDashboardAndVariables } from '../state/actions';

jest.mock('app/features/dashboard/components/DashboardSettings/SettingsCtrl', () => ({}));

interface ScenarioContext {
  cleanUpDashboardAndVariablesMock: typeof cleanUpDashboardAndVariables;
  dashboard?: DashboardModel | null;
  setDashboardProp: (overrides?: any, metaOverrides?: any) => void;
  wrapper?: ShallowWrapper<Props, State, DashboardPage>;
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
      setup: fn => {
        setupFn = fn;
      },
      setDashboardProp: (overrides?: any, metaOverrides?: any) => {
        ctx.dashboard = getTestDashboard(overrides, metaOverrides);
        ctx.wrapper?.setProps({ dashboard: ctx.dashboard });
      },
      mount: (propOverrides?: Partial<Props>) => {
        const props: Props = {
          urlSlug: 'my-dash',
          $scope: {},
          urlUid: '11',
          $injector: {},
          routeInfo: DashboardRouteInfo.Normal,
          initPhase: DashboardInitPhase.NotStarted,
          isInitSlow: false,
          initDashboard: jest.fn(),
          updateLocation: mockToolkitActionCreator(updateLocation),
          notifyApp: mockToolkitActionCreator(notifyApp),
          cleanUpDashboardAndVariables: ctx.cleanUpDashboardAndVariablesMock,
          cancelVariables: jest.fn(),
          dashboard: null,
        };

        Object.assign(props, propOverrides);

        ctx.dashboard = props.dashboard;
        ctx.wrapper = shallow(<DashboardPage {...props} />);
      },
    };

    beforeEach(() => {
      setupFn();
    });

    scenarioFn(ctx);
  });
}

describe('DashboardPage', () => {
  dashboardPageScenario('Given initial state', ctx => {
    ctx.setup(() => {
      ctx.mount();
    });

    it('Should render nothing', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('Dashboard is fetching slowly', ctx => {
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

  dashboardPageScenario('Dashboard init completed ', ctx => {
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

  dashboardPageScenario('When user goes into panel edit', ctx => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setProps({
        urlEditPanelId: '1',
      });
    });

    it('Should update component state to fullscreen and edit', () => {
      const state = ctx.wrapper?.state();
      expect(state).not.toBe(null);
      expect(state?.editPanel).toBeDefined();
    });
  });

  dashboardPageScenario('When user goes back to dashboard from view panel', ctx => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setState({ scrollTop: 100 });
      ctx.wrapper?.setProps({
        urlEditPanelId: '1',
      });
      ctx.wrapper?.setProps({
        urlEditPanelId: undefined,
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

  dashboardPageScenario('When dashboard has editview url state', ctx => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setProps({
        editview: 'settings',
      });
    });

    it('should render settings view', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });

  dashboardPageScenario('When adding panel', ctx => {
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

  dashboardPageScenario('Given panel with id 0', ctx => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp({
        panels: [{ id: 0, type: 'graph' }],
        schemaVersion: 17,
      });
      ctx.wrapper?.setProps({
        urlEditPanelId: '0',
      });
    });

    it('Should go into edit mode', () => {
      const state = ctx.wrapper?.state();
      expect(ctx.wrapper).not.toBe(null);
      expect(state).not.toBe(null);
      expect(state?.editPanel).not.toBe(null);
    });
  });

  dashboardPageScenario('When dashboard unmounts', ctx => {
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

  describe('mapStateToProps with editPanel', () => {
    const props = mapStateToProps({
      location: {
        routeParams: {},
        query: {
          editPanel: '1',
        },
      },
      panelEditor: {},
      dashboard: {
        getModel: () => ({} as DashboardModel),
      },
    } as any);

    expect(props.urlEditPanelId).toBe('1');
  });

  describe('mapStateToProps with string edit true', () => {
    const props = mapStateToProps({
      location: {
        routeParams: {},
        query: {
          viewPanel: '2',
        },
      },
      panelEditor: {},
      dashboard: {
        getModel: () => ({} as DashboardModel),
      },
    } as any);

    expect(props.urlViewPanelId).toBe('2');
  });
});
