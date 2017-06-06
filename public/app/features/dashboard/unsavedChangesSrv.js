define([
  'angular',
  'lodash',
],
function(angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('unsavedChangesSrv', function($rootScope, $q, $location, $timeout, contextSrv, dashboardSrv, $window) {

    function Tracker(dashboard, scope, originalCopyDelay) {
      var self = this;

      this.current = dashboard;
      this.originalPath = $location.path();
      this.scope = scope;

      // register events
      scope.onAppEvent('dashboard-saved', function() {
        this.original = this.current.getSaveModelClone();
        this.originalPath = $location.path();
      }.bind(this));

      $window.onbeforeunload = function() {
        if (self.ignoreChanges()) { return; }
        if (self.hasChanges()) {
          return "There are unsaved changes to this dashboard";
        }
      };

      scope.$on("$locationChangeStart", function(event, next) {
        // check if we should look for changes
        if (self.originalPath === $location.path()) { return true; }
        if (self.ignoreChanges()) { return true; }

        if (self.hasChanges()) {
          event.preventDefault();
          self.next = next;

          $timeout(function() {
            self.open_modal();
          });
        }
      });

      if (originalCopyDelay) {
        $timeout(function() {
          // wait for different services to patch the dashboard (missing properties)
          self.original = dashboard.getSaveModelClone();
        }, originalCopyDelay);
      } else {
        self.original = dashboard.getSaveModelClone();
      }
    }

    var p = Tracker.prototype;

    // for some dashboards and users
    // changes should be ignored
    p.ignoreChanges = function() {
      if (!this.original) { return true; }
      if (!contextSrv.isEditor) { return true; }
      if (!this.current || !this.current.meta) { return true; }

      var meta = this.current.meta;
      return !meta.canSave || meta.fromScript || meta.fromFile;
    };

    // remove stuff that should not count in diff
    p.cleanDashboardFromIgnoredChanges = function(dash) {
      // ignore time and refresh
      dash.time = 0;
      dash.refresh = 0;
      dash.schemaVersion = 0;
      dash.editMode = false;

      // filter row and panels properties that should be ignored
      dash.rows = _.filter(dash.rows, function(row) {
        if (row.repeatRowId) {
          return false;
        }

        row.panels = _.filter(row.panels, function(panel) {
          if (panel.repeatPanelId) {
            return false;
          }

          // remove scopedVars
          panel.scopedVars = null;

          // ignore span changes
          panel.span = null;

          // ignore panel legend sort
          if (panel.legend)  {
            delete panel.legend.sort;
            delete panel.legend.sortDesc;
          }

          return true;
        });

        // ignore collapse state
        row.collapse = false;
        return true;
      });

      // ignore template variable values
      _.each(dash.templating.list, function(value) {
        value.current = null;
        value.options = null;
        value.filters = null;
      });
    };

    p.hasChanges = function() {
      var current = this.current.getSaveModelClone();
      var original = this.original;

      this.cleanDashboardFromIgnoredChanges(current);
      this.cleanDashboardFromIgnoredChanges(original);

      var currentTimepicker = _.find(current.nav, { type: 'timepicker' });
      var originalTimepicker = _.find(original.nav, { type: 'timepicker' });

      if (currentTimepicker && originalTimepicker) {
        currentTimepicker.now = originalTimepicker.now;
      }

      var currentJson = angular.toJson(current);
      var originalJson = angular.toJson(original);

      return currentJson !== originalJson;
    };

    p.discardChanges = function() {
      this.original = null;
      this.gotoNext();
    };

    p.open_modal = function() {
      $rootScope.appEvent('show-modal', {
        templateHtml: '<unsaved-changes-modal dismiss="dismiss()"></unsaved-changes-modal>',
        modalClass: 'modal--narrow confirm-modal'
      });
    };

    p.saveChanges = function() {
      var self = this;
      var cancel = $rootScope.$on('dashboard-saved', function() {
        cancel();
        $timeout(function() {
          self.gotoNext();
        });
      });

      $rootScope.appEvent('save-dashboard');
    };

    p.gotoNext = function() {
      var baseLen = $location.absUrl().length - $location.url().length;
      var nextUrl = this.next.substring(baseLen);
      $location.url(nextUrl);
    };

    this.Tracker = Tracker;
    this.init = function(dashboard, scope) {
      this.tracker = new Tracker(dashboard, scope, 1000);
      return this.tracker;
    };
  });
});
