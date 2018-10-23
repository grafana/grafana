//import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import 'app/features/dashboard/view_state_srv';
import config from 'app/core/config';
import { DashboardViewState } from '../view_state_srv';
import { DashboardModel } from '../dashboard_model';

describe('when updating view state', () => {
  const location = {
    replace: jest.fn(),
    search: jest.fn(),
  };

  const $scope = {
    appEvent: jest.fn(),
    onAppEvent: jest.fn(() => {}),
    dashboard: new DashboardModel({
      panels: [{ id: 1 }],
    }),
  };

  let viewState;

  beforeEach(() => {
    config.bootData = {
      user: {
        orgId: 1,
      },
    };
  });

  describe('to fullscreen true and edit true', () => {
    beforeEach(() => {
      location.search = jest.fn(() => {
        return { fullscreen: true, edit: true, panelId: 1 };
      });
      viewState = new DashboardViewState($scope, location, {});
    });

    it('should update querystring and view state', () => {
      const updateState = { fullscreen: true, edit: true, panelId: 1 };

      viewState.update(updateState);

      expect(location.search).toHaveBeenCalledWith({
        edit: true,
        editview: null,
        fullscreen: true,
        orgId: 1,
        panelId: 1,
      });
      expect(viewState.dashboard.meta.fullscreen).toBe(true);
      expect(viewState.state.fullscreen).toBe(true);
    });
  });

  describe('to fullscreen false', () => {
    beforeEach(() => {
      viewState = new DashboardViewState($scope, location, {});
    });
    it('should remove params from query string', () => {
      viewState.update({ fullscreen: true, panelId: 1, edit: true });
      viewState.update({ fullscreen: false });
      expect(viewState.dashboard.meta.fullscreen).toBe(false);
      expect(viewState.state.fullscreen).toBe(null);
    });
  });
});
