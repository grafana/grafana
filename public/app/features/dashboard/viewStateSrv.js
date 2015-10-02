define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('dashboardViewStateSrv', function($location, $timeout) {

    // represents the transient view state
    // like fullscreen panel & edit
    function DashboardViewState($scope) {
      var self = this;
      self.state = {};
      self.panelScopes = [];
      self.$scope = $scope;

      $scope.exitFullscreen = function() {
        if (self.state.fullscreen) {
          self.update({ fullscreen: false });
        }
      };

      $scope.onAppEvent('$routeUpdate', function() {
        var urlState = self.getQueryStringState();
        if (self.needsSync(urlState)) {
          self.update(urlState, true);
        }
      });

      this.update(this.getQueryStringState(), true);
      this.expandRowForPanel();
    }

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

    DashboardViewState.prototype.update = function(state, skipUrlSync) {
      _.extend(this.state, state);
      this.fullscreen = this.state.fullscreen;

      if (!this.state.fullscreen) {
        this.state.panelId = null;
        this.state.fullscreen = null;
        this.state.edit = null;
      }

      if (!skipUrlSync) {
        $location.search(this.serializeToUrl());
      }

      this.syncState();
    };

    DashboardViewState.prototype.syncState = function() {
      if (this.panelScopes.length === 0) { return; }

      if (this.fullscreen) {
        if (this.fullscreenPanel) {
          this.leaveFullscreen(false);
        }
        var panelScope = this.getPanelScope(this.state.panelId);
        this.enterFullscreen(panelScope);
        return;
      }

      if (this.fullscreenPanel) {
        this.leaveFullscreen(true);
      }
    };

    DashboardViewState.prototype.getPanelScope = function(id) {
      return _.find(this.panelScopes, function(panelScope) {
        return panelScope.panel.id === id;
      });
    };

    DashboardViewState.prototype.leaveFullscreen = function(render) {
      var self = this;

      self.fullscreenPanel.editMode = false;
      self.fullscreenPanel.fullscreen = false;
      delete self.fullscreenPanel.height;

      this.$scope.appEvent('panel-fullscreen-exit', {panelId: this.fullscreenPanel.panel.id});

      if (!render) { return false;}

      $timeout(function() {
        if (self.oldTimeRange !== self.fullscreenPanel.range) {
          self.$scope.broadcastRefresh();
        }
        else {
          self.fullscreenPanel.$broadcast('render');
        }
        delete self.fullscreenPanel;
      });
    };

    DashboardViewState.prototype.enterFullscreen = function(panelScope) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.3);
      var fullscreenHeight = Math.floor(docHeight * 0.7);

      panelScope.editMode = this.state.edit && this.$scope.dashboardMeta.canEdit;
      panelScope.height = panelScope.editMode ? editHeight : fullscreenHeight;

      this.oldTimeRange = panelScope.range;
      this.fullscreenPanel = panelScope;

      $(window).scrollTop(0);

      panelScope.fullscreen = true;
      this.$scope.appEvent('panel-fullscreen-enter', {panelId: panelScope.panel.id});

      $timeout(function() {
        panelScope.$broadcast('render');
      });
    };

    DashboardViewState.prototype.registerPanel = function(panelScope) {
      var self = this;
      self.panelScopes.push(panelScope);

      if (self.state.panelId === panelScope.panel.id) {
        self.enterFullscreen(panelScope);
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
