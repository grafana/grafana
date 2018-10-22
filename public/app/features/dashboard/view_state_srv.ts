import angular from 'angular';
import _ from 'lodash';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import { DashboardModel } from './dashboard_model';

// represents the transient view state
// like fullscreen panel & edit
export class DashboardViewState {
  state: any;
  panelScopes: any;
  $scope: any;
  dashboard: DashboardModel;
  fullscreenPanel: any;
  oldTimeRange: any;

  /** @ngInject */
  constructor($scope, private $location, private $timeout) {
    const self = this;
    self.state = {};
    self.panelScopes = [];
    self.$scope = $scope;
    self.dashboard = $scope.dashboard;

    $scope.onAppEvent('$routeUpdate', () => {
      const urlState = self.getQueryStringState();
      if (self.needsSync(urlState)) {
        self.update(urlState, true);
      }
    });

    $scope.onAppEvent('panel-change-view', (evt, payload) => {
      self.update(payload);
    });

    // this marks changes to location during this digest cycle as not to add history item
    // don't want url changes like adding orgId to add browser history
    $location.replace();
    this.update(this.getQueryStringState());
  }

  needsSync(urlState) {
    return _.isEqual(this.state, urlState) === false;
  }

  getQueryStringState() {
    const state = this.$location.search();
    state.panelId = parseInt(state.panelId, 10) || null;
    state.fullscreen = state.fullscreen ? true : null;
    state.edit = state.edit === 'true' || state.edit === true || null;
    state.editview = state.editview || null;
    state.orgId = config.bootData.user.orgId;
    return state;
  }

  serializeToUrl() {
    const urlState = _.clone(this.state);
    urlState.fullscreen = this.state.fullscreen ? true : null;
    urlState.edit = this.state.edit ? true : null;
    return urlState;
  }

  update(state, fromRouteUpdated?) {
    // implement toggle logic
    if (state.toggle) {
      delete state.toggle;
      if (this.state.fullscreen && state.fullscreen) {
        if (this.state.edit === state.edit) {
          state.fullscreen = !state.fullscreen;
        }
      }
    }

    _.extend(this.state, state);
    this.dashboard.meta.fullscreen = this.state.fullscreen;

    if (!this.state.fullscreen) {
      this.state.fullscreen = null;
      this.state.edit = null;
      // clear panel id unless in solo mode
      if (!this.dashboard.meta.soloMode) {
        this.state.panelId = null;
      }
    }

    if ((this.state.fullscreen || this.dashboard.meta.soloMode) && this.state.panelId) {
      // Trying to render panel in fullscreen when it's in the collapsed row causes an issue.
      // So in this case expand collapsed row first.
      this.toggleCollapsedPanelRow(this.state.panelId);
    }

    // if no edit state cleanup tab parm
    if (!this.state.edit) {
      delete this.state.tab;
    }

    // do not update url params if we are here
    // from routeUpdated event
    if (fromRouteUpdated !== true) {
      this.$location.search(this.serializeToUrl());
    }

    this.syncState();
  }

  toggleCollapsedPanelRow(panelId) {
    for (const panel of this.dashboard.panels) {
      if (panel.collapsed) {
        for (const rowPanel of panel.panels) {
          if (rowPanel.id === panelId) {
            this.dashboard.toggleRow(panel);
            return;
          }
        }
      }
    }
  }

  syncState() {
    if (this.dashboard.meta.fullscreen) {
      const panel = this.dashboard.getPanelById(this.state.panelId);

      if (!panel) {
        return;
      }

      if (!panel.fullscreen) {
        this.enterFullscreen(panel);
      } else {
        // already in fullscreen view just update the view mode
        this.dashboard.setViewMode(panel, this.state.fullscreen, this.state.edit);
      }
    } else if (this.fullscreenPanel) {
      this.leaveFullscreen();
    }
  }

  leaveFullscreen() {
    const panel = this.fullscreenPanel;

    this.dashboard.setViewMode(panel, false, false);

    delete this.fullscreenPanel;

    this.$timeout(() => {
      appEvents.emit('dash-scroll', { restore: true });

      if (this.oldTimeRange !== this.dashboard.time) {
        this.dashboard.startRefresh();
      } else {
        this.dashboard.render();
      }
    });
  }

  enterFullscreen(panel) {
    const isEditing = this.state.edit && this.dashboard.meta.canEdit;

    this.oldTimeRange = this.dashboard.time;
    this.fullscreenPanel = panel;

    // Firefox doesn't return scrollTop position properly if 'dash-scroll' is emitted after setViewMode()
    this.$scope.appEvent('dash-scroll', { animate: false, pos: 0 });
    this.dashboard.setViewMode(panel, true, isEditing);
  }
}

/** @ngInject */
export function dashboardViewStateSrv($location, $timeout) {
  return {
    create: $scope => {
      return new DashboardViewState($scope, $location, $timeout);
    },
  };
}

angular.module('grafana.services').factory('dashboardViewStateSrv', dashboardViewStateSrv);
