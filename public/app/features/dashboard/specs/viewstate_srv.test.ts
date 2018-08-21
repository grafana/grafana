//import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import 'app/features/dashboard/view_state_srv';
import config from 'app/core/config';
import { DashboardViewState } from '../view_state_srv';

describe('when updating view state', () => {
  let location = {
    replace: jest.fn(),
    search: jest.fn(),
  };

  let $scope = {
    onAppEvent: jest.fn(() => {}),
    dashboard: {
      meta: {},
      panels: [],
    },
  };

  let $rootScope = {};
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
      viewState = new DashboardViewState($scope, location, {}, $rootScope);
    });

    it('should update querystring and view state', () => {
      var updateState = { fullscreen: true, edit: true, panelId: 1 };

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
      viewState = new DashboardViewState($scope, location, {}, $rootScope);
    });
    it('should remove params from query string', () => {
      viewState.update({ fullscreen: true, panelId: 1, edit: true });
      viewState.update({ fullscreen: false });
      expect(viewState.dashboard.meta.fullscreen).toBe(false);
      expect(viewState.state.fullscreen).toBe(null);
    });
  });
});
