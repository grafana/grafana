define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('dashboardViewStateSrv', function($location, $timeout, templateSrv, contextSrv, timeSrv) {

    // represents the transient view state
    // like fullscreen panel & edit
    function DashboardViewState($scope) {
      var self = this;
      self.state = {};
      self.panelScopes = [];
      self.$scope = $scope;
      self.dashboard = $scope.dashboard;

      $scope.exitFullscreen = function() {
        if (self.state.fullscreen) {
          self.update({ fullscreen: false });
        }
      };

      // update url on time range change
      $scope.onAppEvent('time-range-changed', function() {
        var urlParams = $location.search();
        var urlRange = timeSrv.timeRangeForUrl();
        urlParams.from = urlRange.from;
        urlParams.to = urlRange.to;
        $location.search(urlParams);
      });

      $scope.onAppEvent('template-variable-value-updated', function() {
        self.updateUrlParamsWithCurrentVariables();
      });

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

      this.update(this.getQueryStringState());
      this.expandRowForPanel();
    }

    DashboardViewState.prototype.updateUrlParamsWithCurrentVariables = function() {
      // update url
      var params = $location.search();
      // remove variable params
      _.each(params, function(value, key) {
        if (key.indexOf('var-') === 0) {
          delete params[key];
        }
      });

      // add new values
      templateSrv.fillVariableValuesForUrl(params);
      // update url
      $location.search(params);
    };

    DashboardViewState.prototype.expandRowForPanel = function() {
      if (!this.state.panelId) { return; }

      var panelInfo = this.$scope.dashboard.getPanelInfoById(this.state.panelId);
      if (panelInfo) {
        panelInfo.row.collapse = false;
      }
    };

    DashboardViewState.prototype.needsSync = function(urlState) {
      return _.isEqual(this.state, urlState) === false;
    };

    DashboardViewState.prototype.getQueryStringState = function() {
      var state = $location.search();
      state.panelId = parseInt(state.panelId) || null;
      state.fullscreen = state.fullscreen ? true : null;
      state.edit =  (state.edit === "true" || state.edit === true) || null;
      state.editview = state.editview || null;
      return state;
    };

    DashboardViewState.prototype.serializeToUrl = function() {
      var urlState = _.clone(this.state);
      urlState.fullscreen = this.state.fullscreen ? true : null;
      urlState.edit = this.state.edit ? true : null;
      return urlState;
    };

    DashboardViewState.prototype.update = function(state) {
      _.extend(this.state, state);
      this.dashboard.meta.fullscreen = this.state.fullscreen;

      if (!this.state.fullscreen) {
        this.state.panelId = null;
        this.state.fullscreen = null;
        this.state.edit = null;
      }

      $location.search(this.serializeToUrl());
      this.syncState();
    };

    DashboardViewState.prototype.syncState = function() {
      if (this.panelScopes.length === 0) { return; }

      if (this.dashboard.meta.fullscreen) {
        if (this.fullscreenPanel) {
          this.leaveFullscreen(false);
        }
        var panelScope = this.getPanelScope(this.state.panelId);
        // panel could be about to be created/added and scope does
        // not exist yet
        if (!panelScope) {
          return;
        }

        if (!panelScope.ctrl.editModeInitiated) {
          panelScope.ctrl.initEditMode();
        }

        this.enterFullscreen(panelScope);
        return;
      }

      if (this.fullscreenPanel) {
        this.leaveFullscreen(true);
      }
    };

    DashboardViewState.prototype.getPanelScope = function(id) {
      return _.find(this.panelScopes, function(panelScope) {
        return panelScope.ctrl.panel.id === id;
      });
    };

    DashboardViewState.prototype.leaveFullscreen = function(render) {
      var self = this;
      var ctrl = self.fullscreenPanel.ctrl;

      ctrl.editMode = false;
      ctrl.fullscreen = false;

      this.$scope.appEvent('panel-fullscreen-exit', {panelId: ctrl.panel.id});

      if (!render) { return false;}

      $timeout(function() {
        if (self.oldTimeRange !== ctrl.range) {
          self.$scope.broadcastRefresh();
        }
        else {
          ctrl.render();
        }
        delete self.fullscreenPanel;
      });
    };

    DashboardViewState.prototype.enterFullscreen = function(panelScope) {
      var ctrl = panelScope.ctrl;

      ctrl.editMode = this.state.edit && this.$scope.dashboardMeta.canEdit;
      ctrl.fullscreen = true;

      this.oldTimeRange = ctrl.range;
      this.fullscreenPanel = panelScope;

      $(window).scrollTop(0);

      this.$scope.appEvent('panel-fullscreen-enter', {panelId: ctrl.panel.id});

      $timeout(function() {
        ctrl.render();
      });
    };

    DashboardViewState.prototype.registerPanel = function(panelScope) {
      var self = this;
      self.panelScopes.push(panelScope);

      if (self.state.panelId === panelScope.ctrl.panel.id) {
        if (self.state.edit) {
          panelScope.ctrl.editPanel();
        } else {
          panelScope.ctrl.viewPanel();
        }
      }

      panelScope.$on('$destroy', function() {
        self.panelScopes = _.without(self.panelScopes, panelScope);
      });
    };

    return {
      create: function($scope) {
        return new DashboardViewState($scope);
      }
    };

  });
});
