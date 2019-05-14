import angular from 'angular';
import _ from 'lodash';
import { DashboardModel } from '../state/DashboardModel';
var ChangeTracker = /** @class */ (function () {
    /** @ngInject */
    function ChangeTracker(dashboard, scope, originalCopyDelay, $location, $window, $timeout, contextSrv, $rootScope) {
        var _this = this;
        this.$location = $location;
        this.$timeout = $timeout;
        this.contextSrv = contextSrv;
        this.$rootScope = $rootScope;
        this.$location = $location;
        this.$window = $window;
        this.current = dashboard;
        this.originalPath = $location.path();
        this.scope = scope;
        // register events
        scope.onAppEvent('dashboard-saved', function () {
            _this.original = _this.current.getSaveModelClone();
            _this.originalPath = $location.path();
        });
        $window.onbeforeunload = function () {
            if (_this.ignoreChanges()) {
                return undefined;
            }
            if (_this.hasChanges()) {
                return 'There are unsaved changes to this dashboard';
            }
            return undefined;
        };
        scope.$on('$locationChangeStart', function (event, next) {
            // check if we should look for changes
            if (_this.originalPath === $location.path()) {
                return true;
            }
            if (_this.ignoreChanges()) {
                return true;
            }
            if (_this.hasChanges()) {
                event.preventDefault();
                _this.next = next;
                _this.$timeout(function () {
                    _this.open_modal();
                });
            }
            return false;
        });
        if (originalCopyDelay) {
            this.$timeout(function () {
                // wait for different services to patch the dashboard (missing properties)
                _this.original = dashboard.getSaveModelClone();
            }, originalCopyDelay);
        }
        else {
            this.original = dashboard.getSaveModelClone();
        }
    }
    // for some dashboards and users
    // changes should be ignored
    ChangeTracker.prototype.ignoreChanges = function () {
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
    };
    // remove stuff that should not count in diff
    ChangeTracker.prototype.cleanDashboardFromIgnoredChanges = function (dashData) {
        // need to new up the domain model class to get access to expand / collapse row logic
        var model = new DashboardModel(dashData);
        // Expand all rows before making comparison. This is required because row expand / collapse
        // change order of panel array and panel positions.
        model.expandRows();
        var dash = model.getSaveModelClone();
        // ignore time and refresh
        dash.time = 0;
        dash.refresh = 0;
        dash.schemaVersion = 0;
        // ignore iteration property
        delete dash.iteration;
        dash.panels = _.filter(dash.panels, function (panel) {
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
        _.each(dash.templating.list, function (value) {
            value.current = null;
            value.options = null;
            value.filters = null;
        });
        return dash;
    };
    ChangeTracker.prototype.hasChanges = function () {
        var current = this.cleanDashboardFromIgnoredChanges(this.current.getSaveModelClone());
        var original = this.cleanDashboardFromIgnoredChanges(this.original);
        var currentTimepicker = _.find(current.nav, { type: 'timepicker' });
        var originalTimepicker = _.find(original.nav, { type: 'timepicker' });
        if (currentTimepicker && originalTimepicker) {
            currentTimepicker.now = originalTimepicker.now;
        }
        var currentJson = angular.toJson(current, true);
        var originalJson = angular.toJson(original, true);
        return currentJson !== originalJson;
    };
    ChangeTracker.prototype.discardChanges = function () {
        this.original = null;
        this.gotoNext();
    };
    ChangeTracker.prototype.open_modal = function () {
        this.$rootScope.appEvent('show-modal', {
            templateHtml: '<unsaved-changes-modal dismiss="dismiss()"></unsaved-changes-modal>',
            modalClass: 'modal--narrow confirm-modal',
        });
    };
    ChangeTracker.prototype.saveChanges = function () {
        var _this = this;
        var self = this;
        var cancel = this.$rootScope.$on('dashboard-saved', function () {
            cancel();
            _this.$timeout(function () {
                self.gotoNext();
            });
        });
        this.$rootScope.appEvent('save-dashboard');
    };
    ChangeTracker.prototype.gotoNext = function () {
        var baseLen = this.$location.absUrl().length - this.$location.url().length;
        var nextUrl = this.next.substring(baseLen);
        this.$location.url(nextUrl);
    };
    return ChangeTracker;
}());
export { ChangeTracker };
//# sourceMappingURL=ChangeTracker.js.map