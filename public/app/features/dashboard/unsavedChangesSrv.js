define([
  'angular',
  'lodash',
],
function(angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('unsavedChangesSrv', function($modal, $q, $location, $timeout, contextSrv, $window) {

    function Tracker(dashboard, scope) {
      var self = this;

      this.original = dashboard.getSaveModelClone();
      this.current = dashboard;
      this.originalPath = $location.path();
      this.scope = scope;

      // register events
      scope.onAppEvent('dashboard-saved', function() {
        self.original = self.current.getSaveModelClone();
        self.originalPath = $location.path();
      });

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
    }

    var p = Tracker.prototype;

    // for some dashboards and users
    // changes should be ignored
    p.ignoreChanges = function() {
      if (!this.original) { return false; }
      if (!contextSrv.isEditor) { return true; }
      if (!this.current || !this.current.meta) { return true; }

      var meta = this.current.meta;
      return !meta.canSave || meta.fromScript || meta.fromFile;
    };

    // remove stuff that should not count in diff
    p.cleanDashboardFromIgnoredChanges = function(dash) {
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
          return true;
        });

        return true;
      });
    };

    p.hasChanges = function() {
      var current = this.current.getSaveModelClone();
      var original = this.original;

      // ignore timespan changes
      current.time = original.time = {};
      current.refresh = original.refresh;
      // ignore version
      current.version = original.version;

      // ignore template variable values
      _.each(current.templating.list, function(value, index) {
        value.current = null;
        value.options = null;

        if (original.templating.list.length > index) {
          original.templating.list[index].current = null;
          original.templating.list[index].options = null;
        }
      });

      this.cleanDashboardFromIgnoredChanges(current);
      this.cleanDashboardFromIgnoredChanges(original);

      // ignore some panel and row stuff
      current.forEachPanel(function(panel, panelIndex, row, rowIndex) {
        var originalRow = original.rows[rowIndex];
        var originalPanel = original.getPanelById(panel.id);
        // ignore row collapse state
        if (originalRow) {
          row.collapse = originalRow.collapse;
        }
        if (originalPanel) {
          // ignore graph legend sort
          if (originalPanel.legend && panel.legend)  {
            delete originalPanel.legend.sortDesc;
            delete originalPanel.legend.sort;
            delete panel.legend.sort;
            delete panel.legend.sortDesc;
          }
        }
      });

      var currentTimepicker = _.findWhere(current.nav, { type: 'timepicker' });
      var originalTimepicker = _.findWhere(original.nav, { type: 'timepicker' });

      if (currentTimepicker && originalTimepicker) {
        currentTimepicker.now = originalTimepicker.now;
      }

      var currentJson = angular.toJson(current);
      var originalJson = angular.toJson(original);

      if (currentJson !== originalJson) {
        return true;
      }

      return false;
    };

    p.open_modal = function() {
      var tracker = this;

      var modalScope = this.scope.$new();
      modalScope.ignore = function() {
        tracker.original = null;
        tracker.goto_next();
      };

      modalScope.save = function() {
        tracker.scope.$emit('save-dashboard');
      };

      var confirmModal = $modal({
        template: './app/partials/unsaved-changes.html',
        modalClass: 'confirm-modal',
        persist: false,
        show: false,
        scope: modalScope,
        keyboard: false
      });

      $q.when(confirmModal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

    p.goto_next = function() {
      var baseLen = $location.absUrl().length - $location.url().length;
      var nextUrl = this.next.substring(baseLen);
      $location.url(nextUrl);
    };

    this.Tracker = Tracker;
    this.init = function(dashboard, scope) {
      // wait for different services to patch the dashboard (missing properties)
      $timeout(function() { new Tracker(dashboard, scope); }, 1200);
    };
  });
});
