import angular from 'angular';
import _ from 'lodash';
import config from 'app/core/config';
import { DashboardModel } from './dashboard_model';

// represents the transient view state
// like fullscreen panel & edit
export class DashboardViewState {
  state: any;
  panelScopes: any;
  $scope: any;
  dashboard: DashboardModel;
  editStateChanged: any;
  fullscreenPanel: any;
  oldTimeRange: any;

  /** @ngInject */
  constructor($scope, private $location, private $timeout, private $rootScope) {
    var self = this;
    self.state = {};
    self.panelScopes = [];
    self.$scope = $scope;
    self.dashboard = $scope.dashboard;

    $scope.onAppEvent('$routeUpdate', function() {
      var urlState = self.getQueryStringState();
      if (self.needsSync(urlState)) {
        self.update(urlState, true);
      }
    });

    $scope.onAppEvent('panel-change-view', function(evt, payload) {
      self.update(payload);
    });

    $scope.onAppEvent('panel-initialized', function(evt, payload) {
      self.registerPanel(payload.scope);
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
    var state = this.$location.search();
    state.panelId = parseInt(state.panelId) || null;
    state.fullscreen = state.fullscreen ? true : null;
    state.edit = state.edit === 'true' || state.edit === true || null;
    state.editview = state.editview || null;
    state.orgId = config.bootData.user.orgId;
    return state;
  }

  serializeToUrl() {
    var urlState = _.clone(this.state);
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

    // remember if editStateChanged
    this.editStateChanged = (state.edit || false) !== (this.state.edit || false);

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
    for (let panel of this.dashboard.panels) {
      if (panel.collapsed) {
        for (let rowPanel of panel.panels) {
          if (rowPanel.id === panelId) {
            this.dashboard.toggleRow(panel);
            return;
          }
        }
      }
    }
  }

  syncState() {
    if (this.panelScopes.length === 0) {
      return;
    }

    if (this.dashboard.meta.fullscreen) {
      var panelScope = this.getPanelScope(this.state.panelId);
      if (!panelScope) {
        return;
      }

      if (this.fullscreenPanel) {
        // if already fullscreen
        if (this.fullscreenPanel === panelScope && this.editStateChanged === false) {
          return;
        } else {
          this.leaveFullscreen(false);
        }
      }

      if (!panelScope.ctrl.editModeInitiated) {
        panelScope.ctrl.initEditMode();
      }

      if (!panelScope.ctrl.fullscreen) {
        this.enterFullscreen(panelScope);
      }
    } else if (this.fullscreenPanel) {
      this.leaveFullscreen(true);
    }
  }

  getPanelScope(id) {
    return _.find(this.panelScopes, function(panelScope) {
      return panelScope.ctrl.panel.id === id;
    });
  }

  leaveFullscreen(render) {
    var self = this;
    var ctrl = self.fullscreenPanel.ctrl;

    ctrl.editMode = false;
    ctrl.fullscreen = false;

    this.dashboard.setViewMode(ctrl.panel, false, false);
    this.$scope.appEvent('panel-fullscreen-exit', { panelId: ctrl.panel.id });
    this.$scope.appEvent('dash-scroll', { restore: true });

    if (!render) {
      return false;
    }

    this.$timeout(function() {
      if (self.oldTimeRange !== ctrl.range) {
        self.$rootScope.$broadcast('refresh');
      } else {
        self.$rootScope.$broadcast('render');
      }
      delete self.fullscreenPanel;
    });
    return true;
  }

  enterFullscreen(panelScope) {
    var ctrl = panelScope.ctrl;

    ctrl.editMode = this.state.edit && this.dashboard.meta.canEdit;
    ctrl.fullscreen = true;

    this.oldTimeRange = ctrl.range;
    this.fullscreenPanel = panelScope;

    // Firefox doesn't return scrollTop position properly if 'dash-scroll' is emitted after setViewMode()
    this.$scope.appEvent('dash-scroll', { animate: false, pos: 0 });
    this.dashboard.setViewMode(ctrl.panel, true, ctrl.editMode);
    this.$scope.appEvent('panel-fullscreen-enter', { panelId: ctrl.panel.id });
  }

  registerPanel(panelScope) {
    var self = this;
    self.panelScopes.push(panelScope);

    if (!self.dashboard.meta.soloMode) {
      if (self.state.panelId === panelScope.ctrl.panel.id) {
        if (self.state.edit) {
          panelScope.ctrl.editPanel();
        } else {
          panelScope.ctrl.viewPanel();
        }
      }
    }

    var unbind = panelScope.$on('$destroy', function() {
      self.panelScopes = _.without(self.panelScopes, panelScope);
      unbind();
    });
  }
}

/** @ngInject */
export function dashboardViewStateSrv($location, $timeout, $rootScope) {
  return {
    create: function($scope) {
      return new DashboardViewState($scope, $location, $timeout, $rootScope);
    },
  };
}

angular.module('grafana.services').factory('dashboardViewStateSrv', dashboardViewStateSrv);
