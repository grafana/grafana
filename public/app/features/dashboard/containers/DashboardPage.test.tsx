import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { DashboardPage, mapStateToProps, Props, State } from './DashboardPage';
import { DashboardModel } from '../state';
import { cleanUpDashboard } from '../state/reducers';
import {
  mockToolkitActionCreator,
  mockToolkitActionCreatorWithoutPayload,
  ToolkitActionCreatorWithoutPayloadMockType,
} from 'test/core/redux/mocks';
import { DashboardInitPhase, DashboardRouteInfo } from 'app/types';
import { notifyApp, updateLocation } from 'app/core/actions';

jest.mock('app/features/dashboard/components/DashboardSettings/SettingsCtrl', () => ({}));

interface ScenarioContext {
  cleanUpDashboardMock: ToolkitActionCreatorWithoutPayloadMockType;
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
      cleanUpDashboardMock: mockToolkitActionCreatorWithoutPayload(cleanUpDashboard),
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
          urlEdit: false,
          urlFullscreen: false,
          initPhase: DashboardInitPhase.NotStarted,
          isInitSlow: false,
          initDashboard: jest.fn(),
          updateLocation: mockToolkitActionCreator(updateLocation),
          notifyApp: mockToolkitActionCreator(notifyApp),
          cleanUpDashboard: ctx.cleanUpDashboardMock,
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
        urlFullscreen: true,
        urlEdit: true,
        urlPanelId: '1',
      });
    });

    it('Should update model state to fullscreen & edit', () => {
      expect(ctx.dashboard).not.toBe(null);
      expect(ctx.dashboard?.meta.fullscreen).toBe(true);
      expect(ctx.dashboard?.meta.isEditing).toBe(true);
    });

    it('Should update component state to fullscreen and edit', () => {
      const state = ctx.wrapper?.state();
      expect(state).not.toBe(null);
      expect(state?.isEditing).toBe(true);
      expect(state?.isFullscreen).toBe(true);
    });
  });

  dashboardPageScenario('When user goes back to dashboard from panel edit', ctx => {
    ctx.setup(() => {
      ctx.mount();
      ctx.setDashboardProp();
      ctx.wrapper?.setState({ scrollTop: 100 });
      ctx.wrapper?.setProps({
        urlFullscreen: true,
        urlEdit: true,
        urlPanelId: '1',
      });
      ctx.wrapper?.setProps({
        urlFullscreen: false,
        urlEdit: false,
        urlPanelId: (null as unknown) as string,
      });
    });

    it('Should update model state normal state', () => {
      expect(ctx.dashboard).not.toBe(null);
      expect(ctx.dashboard?.meta.fullscreen).toBe(false);
      expect(ctx.dashboard?.meta.isEditing).toBe(false);
    });

    it('Should update component state to normal and restore scrollTop', () => {
      const state = ctx.wrapper?.state();
      expect(ctx.wrapper).not.toBe(null);
      expect(state).not.toBe(null);
      expect(state?.isEditing).toBe(false);
      expect(state?.isFullscreen).toBe(false);
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

    it('should set animation state', () => {
      expect(ctx.wrapper?.state().isSettingsOpening).toBe(true);
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
        urlEdit: true,
        urlFullscreen: true,
        urlPanelId: '0',
      });
    });

    it('Should go into edit mode', () => {
      const state = ctx.wrapper?.state();
      expect(ctx.wrapper).not.toBe(null);
      expect(state).not.toBe(null);
      expect(state?.fullscreenPanel).not.toBe(null);
      expect(state?.fullscreenPanel?.id).toBe(0);
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
      expect(ctx.cleanUpDashboardMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapStateToProps with bool fullscreen', () => {
    const props = mapStateToProps({
      location: {
        routeParams: {},
        query: {
          fullscreen: true,
          edit: false,
        },
      },
      panelEditorNew: {},
      dashboard: {
        getModel: () => ({} as DashboardModel),
      },
    } as any);

    expect(props.urlFullscreen).toBe(true);
    expect(props.urlEdit).toBe(false);
  });

  describe('mapStateToProps with string edit true', () => {
    const props = mapStateToProps({
      location: {
        routeParams: {},
        query: {
          fullscreen: false,
          edit: 'true',
        },
      },
      panelEditorNew: {},
      dashboard: {
        getModel: () => ({} as DashboardModel),
      },
    } as any);

    expect(props.urlFullscreen).toBe(false);
    expect(props.urlEdit).toBe(true);
  });
});
