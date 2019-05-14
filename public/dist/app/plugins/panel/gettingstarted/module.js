import * as tslib_1 from "tslib";
import { PanelCtrl } from 'app/plugins/sdk';
import { contextSrv } from 'app/core/core';
var GettingStartedPanelCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(GettingStartedPanelCtrl, _super);
    /** @ngInject */
    function GettingStartedPanelCtrl($scope, $injector, backendSrv, datasourceSrv, $q) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.backendSrv = backendSrv;
        _this.$q = $q;
        _this.stepIndex = 0;
        _this.steps = [];
        _this.steps.push({
            title: 'Install Grafana',
            icon: 'icon-gf icon-gf-check',
            href: 'http://docs.grafana.org/',
            target: '_blank',
            note: 'Review the installation docs',
            check: function () { return $q.when(true); },
        });
        _this.steps.push({
            title: 'Create your first data source',
            cta: 'Add data source',
            icon: 'icon-gf icon-gf-datasources',
            href: 'datasources/new?gettingstarted',
            check: function () {
                return $q.when(datasourceSrv.getMetricSources().filter(function (item) {
                    return item.meta.builtIn !== true;
                }).length > 0);
            },
        });
        _this.steps.push({
            title: 'Create your first dashboard',
            cta: 'New dashboard',
            icon: 'icon-gf icon-gf-dashboard',
            href: 'dashboard/new?gettingstarted',
            check: function () {
                return _this.backendSrv.search({ limit: 1 }).then(function (result) {
                    return result.length > 0;
                });
            },
        });
        _this.steps.push({
            title: 'Invite your team',
            cta: 'Add Users',
            icon: 'icon-gf icon-gf-users',
            href: 'org/users?gettingstarted',
            check: function () {
                return _this.backendSrv.get('/api/org/users').then(function (res) {
                    return res.length > 1;
                });
            },
        });
        _this.steps.push({
            title: 'Install apps & plugins',
            cta: 'Explore plugin repository',
            icon: 'icon-gf icon-gf-apps',
            href: 'https://grafana.com/plugins?utm_source=grafana_getting_started',
            check: function () {
                return _this.backendSrv.get('/api/plugins', { embedded: 0, core: 0 }).then(function (plugins) {
                    return plugins.length > 0;
                });
            },
        });
        return _this;
    }
    GettingStartedPanelCtrl.prototype.$onInit = function () {
        var _this = this;
        this.stepIndex = -1;
        return this.nextStep().then(function (res) {
            _this.checksDone = true;
        });
    };
    GettingStartedPanelCtrl.prototype.nextStep = function () {
        var _this = this;
        if (this.stepIndex === this.steps.length - 1) {
            return this.$q.when();
        }
        this.stepIndex += 1;
        var currentStep = this.steps[this.stepIndex];
        return currentStep.check().then(function (passed) {
            if (passed) {
                currentStep.cssClass = 'completed';
                return _this.nextStep();
            }
            currentStep.cssClass = 'active';
            return _this.$q.when();
        });
    };
    GettingStartedPanelCtrl.prototype.dismiss = function () {
        this.dashboard.removePanel(this.panel, false);
        this.backendSrv
            .request({
            method: 'PUT',
            url: '/api/user/helpflags/1',
            showSuccessAlert: false,
        })
            .then(function (res) {
            contextSrv.user.helpFlags1 = res.helpFlags1;
        });
    };
    GettingStartedPanelCtrl.templateUrl = 'public/app/plugins/panel/gettingstarted/module.html';
    return GettingStartedPanelCtrl;
}(PanelCtrl));
export { GettingStartedPanelCtrl, GettingStartedPanelCtrl as PanelCtrl };
//# sourceMappingURL=module.js.map