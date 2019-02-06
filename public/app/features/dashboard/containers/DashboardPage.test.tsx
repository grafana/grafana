import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { DashboardPage, Props, State } from './DashboardPage';
import { DashboardModel } from '../state';
import { setDashboardModel } from '../state/actions';
import { DashboardRouteInfo, DashboardLoadingState } from 'app/types';

jest.mock('sass/_variables.scss', () => ({
  panelhorizontalpadding: 10,
  panelVerticalPadding: 10,
}));

jest.mock('app/features/dashboard/components/DashboardSettings/SettingsCtrl', () => ({
}));

function setup(propOverrides?: Partial<Props>): ShallowWrapper<Props, State, DashboardPage> {
  const props: Props = {
    urlUid: '11',
    urlSlug: 'my-dash',
    $scope: {},
    $injector: {},
    routeInfo: DashboardRouteInfo.Normal,
    urlEdit: false,
    urlFullscreen: false,
    loadingState: DashboardLoadingState.Done,
    isLoadingSlow: false,
    initDashboard: jest.fn(),
    updateLocation: jest.fn(),
    notifyApp: jest.fn(),
    dashboard: null,
    setDashboardModel: setDashboardModel,
  };

  Object.assign(props, propOverrides);
  return shallow(<DashboardPage {...props} />);
}

describe('DashboardPage', () => {
  let wrapper: ShallowWrapper<Props, State, DashboardPage>;

  beforeEach(() => {
    wrapper = setup();
  });

  describe('Given dashboard has not loaded yet', () => {
    it('should render nothing', () => {
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('Given dashboard model', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = new DashboardModel({
        title: 'My dashboard',
        panels: [
          {
            id: 1,
            type: 'graph',
            title: 'My graph',
            gridPos: { x: 0, y: 0, w: 1, h: 1 }
          }
        ]
      }, {
        canEdit: true,
        canSave: true,
      });
      wrapper.setProps({ dashboard, loadingState: DashboardLoadingState.Done });
    });

    it('Should update title', () => {
      expect(document.title).toBe('My dashboard - Grafana');
    });

    it('After render dashboard', () => {
      expect(wrapper).toMatchSnapshot();
    });

    describe('Given user has scrolled down and goes into fullscreen edit', () => {
      beforeEach(() => {
        wrapper.setState({ scrollTop: 100 });
        wrapper.setProps({
          urlFullscreen: true,
          urlEdit: true,
          urlPanelId: '1',
        });
      });

      it('Should update model state to fullscreen & edit', () => {
        expect(dashboard.meta.fullscreen).toBe(true);
        expect(dashboard.meta.isEditing).toBe(true);
      });

      it('Should update component state to fullscreen and edit', () => {
        const state = wrapper.state();
        expect(state.isEditing).toBe(true);
        expect(state.isFullscreen).toBe(true);
        expect(state.rememberScrollTop).toBe(100);
      });

      describe('Given user goes back to dashboard', () => {
        beforeEach(() => {
          wrapper.setState({ scrollTop: 0 });
          wrapper.setProps({
            urlFullscreen: false,
            urlEdit: false,
            urlPanelId: null,
          });
        });

        it('Should update model state normal state', () => {
          expect(dashboard.meta.fullscreen).toBe(false);
          expect(dashboard.meta.isEditing).toBe(false);
        });

        it('Should update component state to normal and restore scrollTop', () => {
          const state = wrapper.state();
          expect(state.isEditing).toBe(false);
          expect(state.isFullscreen).toBe(false);
          expect(state.scrollTop).toBe(100);
        });
      });
    });
  });
});
