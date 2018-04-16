import angular from 'angular';
import _ from 'lodash';

export class Tracker {
  current: any;
  originalPath: any;
  scope: any;
  original: any;
  next: any;
  $window: any;

  /** @ngInject */
  constructor(
    dashboard,
    scope,
    originalCopyDelay,
    private $location,
    $window,
    private $timeout,
    private contextSrv,
    private $rootScope
  ) {
    this.$location = $location;
    this.$window = $window;

    this.current = dashboard;
    this.originalPath = $location.path();
    this.scope = scope;

    // register events
    scope.onAppEvent('dashboard-saved', () => {
      this.original = this.current.getSaveModelClone();
      this.originalPath = $location.path();
    });

    $window.onbeforeunload = () => {
      if (this.ignoreChanges()) {
        return undefined;
      }
      if (this.hasChanges()) {
        return 'There are unsaved changes to this dashboard';
      }
      return undefined;
    };

    scope.$on('$locationChangeStart', (event, next) => {
      // check if we should look for changes
      if (this.originalPath === $location.path()) {
        return true;
      }
      if (this.ignoreChanges()) {
        return true;
      }

      if (this.hasChanges()) {
        event.preventDefault();
        this.next = next;

        this.$timeout(() => {
          this.open_modal();
        });
      }
      return false;
    });

    if (originalCopyDelay) {
      this.$timeout(() => {
        // wait for different services to patch the dashboard (missing properties)
        this.original = dashboard.getSaveModelClone();
      }, originalCopyDelay);
    } else {
      this.original = dashboard.getSaveModelClone();
    }
  }

  // for some dashboards and users
  // changes should be ignored
  ignoreChanges() {
    if (!this.original) {
      return true;
    }
    if (!this.contextSrv.isEditor) {
      return true;
    }
    if (!this.current || !this.current.meta) {
      return true;
    }

    var meta = this.current.meta;
    return !meta.canSave || meta.fromScript || meta.fromFile;
  }

  // remove stuff that should not count in diff
  cleanDashboardFromIgnoredChanges(dash) {
    // ignore time and refresh
    dash.time = 0;
    dash.refresh = 0;
    dash.schemaVersion = 0;

    // ignore iteration property
    delete dash.iteration;

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
        if (panel.legend) {
          delete panel.legend.sort;
          delete panel.legend.sortDesc;
        }

        return true;
      });

      // ignore collapse state
      row.collapse = false;
      return true;
    });

    dash.panels = _.filter(dash.panels, panel => {
      if (panel.repeatPanelId) {
        return false;
      }

      // remove scopedVars
      panel.scopedVars = null;

      // ignore panel legend sort
      if (panel.legend) {
        delete panel.legend.sort;
        delete panel.legend.sortDesc;
      }

      return true;
    });

    // ignore template variable values
    _.each(dash.templating.list, function(value) {
      value.current = null;
      value.options = null;
      value.filters = null;
    });
  }

  hasChanges() {
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
  }

  discardChanges() {
    this.original = null;
    this.gotoNext();
  }

  open_modal() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<unsaved-changes-modal dismiss="dismiss()"></unsaved-changes-modal>',
      modalClass: 'modal--narrow confirm-modal',
    });
  }

  saveChanges() {
    var self = this;
    var cancel = this.$rootScope.$on('dashboard-saved', () => {
      cancel();
      this.$timeout(() => {
        self.gotoNext();
      });
    });

    this.$rootScope.appEvent('save-dashboard');
  }

  gotoNext() {
    var baseLen = this.$location.absUrl().length - this.$location.url().length;
    var nextUrl = this.next.substring(baseLen);
    this.$location.url(nextUrl);
  }
}

/** @ngInject */
export function unsavedChangesSrv($rootScope, $q, $location, $timeout, contextSrv, dashboardSrv, $window) {
  this.Tracker = Tracker;
  this.init = function(dashboard, scope) {
    this.tracker = new Tracker(dashboard, scope, 1000, $location, $window, $timeout, contextSrv, $rootScope);
    return this.tracker;
  };
}

angular.module('grafana.services').service('unsavedChangesSrv', unsavedChangesSrv);
