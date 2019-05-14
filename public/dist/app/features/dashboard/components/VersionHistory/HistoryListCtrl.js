import * as tslib_1 from "tslib";
import _ from 'lodash';
import angular from 'angular';
import moment from 'moment';
import locationUtil from 'app/core/utils/location_util';
var HistoryListCtrl = /** @class */ (function () {
    /** @ngInject */
    function HistoryListCtrl($route, $rootScope, $location, $q, historySrv, $scope) {
        this.$route = $route;
        this.$rootScope = $rootScope;
        this.$location = $location;
        this.$q = $q;
        this.historySrv = historySrv;
        this.$scope = $scope;
        this.appending = false;
        this.diff = 'basic';
        this.limit = 10;
        this.loading = false;
        this.max = 2;
        this.mode = 'list';
        this.start = 0;
        this.canCompare = false;
        this.$rootScope.onAppEvent('dashboard-saved', this.onDashboardSaved.bind(this), $scope);
        this.resetFromSource();
    }
    HistoryListCtrl.prototype.onDashboardSaved = function () {
        this.resetFromSource();
    };
    HistoryListCtrl.prototype.switchMode = function (mode) {
        this.mode = mode;
        if (this.mode === 'list') {
            this.reset();
        }
    };
    HistoryListCtrl.prototype.dismiss = function () {
        this.$rootScope.appEvent('hide-dash-editor');
    };
    HistoryListCtrl.prototype.addToLog = function () {
        this.start = this.start + this.limit;
        this.getLog(true);
    };
    HistoryListCtrl.prototype.revisionSelectionChanged = function () {
        var selected = _.filter(this.revisions, { checked: true }).length;
        this.canCompare = selected === 2;
    };
    HistoryListCtrl.prototype.formatDate = function (date) {
        return this.dashboard.formatDate(date);
    };
    HistoryListCtrl.prototype.formatBasicDate = function (date) {
        var now = this.dashboard.timezone === 'browser' ? moment() : moment.utc();
        var then = this.dashboard.timezone === 'browser' ? moment(date) : moment.utc(date);
        return then.from(now);
    };
    HistoryListCtrl.prototype.getDiff = function (diff) {
        var _this = this;
        this.diff = diff;
        this.mode = 'compare';
        // have it already been fetched?
        if (this.delta[this.diff]) {
            return this.$q.when(this.delta[this.diff]);
        }
        var selected = _.filter(this.revisions, { checked: true });
        this.newInfo = selected[0];
        this.baseInfo = selected[1];
        this.isNewLatest = this.newInfo.version === this.dashboard.version;
        this.loading = true;
        var options = {
            new: {
                dashboardId: this.dashboard.id,
                version: this.newInfo.version,
            },
            base: {
                dashboardId: this.dashboard.id,
                version: this.baseInfo.version,
            },
            diffType: diff,
        };
        return this.historySrv
            .calculateDiff(options)
            .then(function (response) {
            _this.delta[_this.diff] = response;
        })
            .catch(function () {
            _this.mode = 'list';
        })
            .finally(function () {
            _this.loading = false;
        });
    };
    HistoryListCtrl.prototype.getLog = function (append) {
        var _this = this;
        if (append === void 0) { append = false; }
        this.loading = !append;
        this.appending = append;
        var options = {
            limit: this.limit,
            start: this.start,
        };
        return this.historySrv
            .getHistoryList(this.dashboard, options)
            .then(function (revisions) {
            var e_1, _a;
            try {
                // set formatted dates & default values
                for (var revisions_1 = tslib_1.__values(revisions), revisions_1_1 = revisions_1.next(); !revisions_1_1.done; revisions_1_1 = revisions_1.next()) {
                    var rev = revisions_1_1.value;
                    rev.createdDateString = _this.formatDate(rev.created);
                    rev.ageString = _this.formatBasicDate(rev.created);
                    rev.checked = false;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (revisions_1_1 && !revisions_1_1.done && (_a = revisions_1.return)) _a.call(revisions_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            _this.revisions = append ? _this.revisions.concat(revisions) : revisions;
        })
            .catch(function (err) {
            _this.loading = false;
        })
            .finally(function () {
            _this.loading = false;
            _this.appending = false;
        });
    };
    HistoryListCtrl.prototype.isLastPage = function () {
        return _.find(this.revisions, function (rev) { return rev.version === 1; });
    };
    HistoryListCtrl.prototype.reset = function () {
        this.delta = { basic: '', json: '' };
        this.diff = 'basic';
        this.mode = 'list';
        this.revisions = _.map(this.revisions, function (rev) { return _.extend({}, rev, { checked: false }); });
        this.canCompare = false;
        this.start = 0;
        this.isNewLatest = false;
    };
    HistoryListCtrl.prototype.resetFromSource = function () {
        this.revisions = [];
        return this.getLog().then(this.reset.bind(this));
    };
    HistoryListCtrl.prototype.restore = function (version) {
        this.$rootScope.appEvent('confirm-modal', {
            title: 'Restore version',
            text: '',
            text2: "Are you sure you want to restore the dashboard to version " + version + "? All unsaved changes will be lost.",
            icon: 'fa-history',
            yesText: "Yes, restore to version " + version,
            onConfirm: this.restoreConfirm.bind(this, version),
        });
    };
    HistoryListCtrl.prototype.restoreConfirm = function (version) {
        var _this = this;
        this.loading = true;
        return this.historySrv
            .restoreDashboard(this.dashboard, version)
            .then(function (response) {
            _this.$location.url(locationUtil.stripBaseFromUrl(response.url)).replace();
            _this.$route.reload();
            _this.$rootScope.appEvent('alert-success', ['Dashboard restored', 'Restored from version ' + version]);
        })
            .catch(function () {
            _this.mode = 'list';
            _this.loading = false;
        });
    };
    return HistoryListCtrl;
}());
export { HistoryListCtrl };
export function dashboardHistoryDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/VersionHistory/template.html',
        controller: HistoryListCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dashboard: '=',
        },
    };
}
angular.module('grafana.directives').directive('gfDashboardHistory', dashboardHistoryDirective);
//# sourceMappingURL=HistoryListCtrl.js.map