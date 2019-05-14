import * as tslib_1 from "tslib";
import angular from 'angular';
import _ from 'lodash';
import Remarkable from 'remarkable';
var PluginEditCtrl = /** @class */ (function () {
    /** @ngInject */
    function PluginEditCtrl($scope, $rootScope, backendSrv, $sce, $routeParams, navModelSrv) {
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.backendSrv = backendSrv;
        this.$sce = $sce;
        this.$routeParams = $routeParams;
        this.pluginId = $routeParams.pluginId;
        this.preUpdateHook = function () { return Promise.resolve(); };
        this.postUpdateHook = function () { return Promise.resolve(); };
        this.init();
    }
    PluginEditCtrl.prototype.setNavModel = function (model) {
        var e_1, _a;
        var defaultTab = 'readme';
        this.navModel = {
            main: {
                img: model.info.logos.large,
                subTitle: model.info.author.name,
                url: '',
                text: model.name,
                breadcrumbs: [{ title: 'Plugins', url: 'plugins' }],
                children: [
                    {
                        icon: 'fa fa-fw fa-file-text-o',
                        id: 'readme',
                        text: 'Readme',
                        url: "plugins/" + this.model.id + "/edit?tab=readme",
                    },
                ],
            },
        };
        if (model.type === 'app') {
            this.navModel.main.children.push({
                icon: 'gicon gicon-cog',
                id: 'config',
                text: 'Config',
                url: "plugins/" + this.model.id + "/edit?tab=config",
            });
            var hasDashboards = _.find(model.includes, { type: 'dashboard' });
            if (hasDashboards) {
                this.navModel.main.children.push({
                    icon: 'gicon gicon-dashboard',
                    id: 'dashboards',
                    text: 'Dashboards',
                    url: "plugins/" + this.model.id + "/edit?tab=dashboards",
                });
            }
            defaultTab = 'config';
        }
        this.tab = this.$routeParams.tab || defaultTab;
        try {
            for (var _b = tslib_1.__values(this.navModel.main.children), _c = _b.next(); !_c.done; _c = _b.next()) {
                var tab = _c.value;
                if (tab.id === this.tab) {
                    tab.active = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    PluginEditCtrl.prototype.init = function () {
        var _this = this;
        return this.backendSrv.get("/api/plugins/" + this.pluginId + "/settings").then(function (result) {
            _this.model = result;
            _this.pluginIcon = _this.getPluginIcon(_this.model.type);
            _this.model.dependencies.plugins.forEach(function (plug) {
                plug.icon = _this.getPluginIcon(plug.type);
            });
            _this.includes = _.map(result.includes, function (plug) {
                plug.icon = _this.getPluginIcon(plug.type);
                return plug;
            });
            _this.setNavModel(_this.model);
            return _this.initReadme();
        });
    };
    PluginEditCtrl.prototype.initReadme = function () {
        var _this = this;
        return this.backendSrv.get("/api/plugins/" + this.pluginId + "/markdown/readme").then(function (res) {
            var md = new Remarkable({
                linkify: true,
            });
            _this.readmeHtml = _this.$sce.trustAsHtml(md.render(res));
        });
    };
    PluginEditCtrl.prototype.getPluginIcon = function (type) {
        switch (type) {
            case 'datasource':
                return 'icon-gf icon-gf-datasources';
            case 'panel':
                return 'icon-gf icon-gf-panel';
            case 'app':
                return 'icon-gf icon-gf-apps';
            case 'page':
                return 'icon-gf icon-gf-endpoint-tiny';
            case 'dashboard':
                return 'icon-gf icon-gf-dashboard';
            default:
                return 'icon-gf icon-gf-apps';
        }
    };
    PluginEditCtrl.prototype.update = function () {
        var _this = this;
        this.preUpdateHook()
            .then(function () {
            var updateCmd = _.extend({
                enabled: _this.model.enabled,
                pinned: _this.model.pinned,
                jsonData: _this.model.jsonData,
                secureJsonData: _this.model.secureJsonData,
            }, {});
            return _this.backendSrv.post("/api/plugins/" + _this.pluginId + "/settings", updateCmd);
        })
            .then(this.postUpdateHook)
            .then(function (res) {
            window.location.href = window.location.href;
        });
    };
    PluginEditCtrl.prototype.importDashboards = function () {
        return Promise.resolve();
    };
    PluginEditCtrl.prototype.setPreUpdateHook = function (callback) {
        this.preUpdateHook = callback;
    };
    PluginEditCtrl.prototype.setPostUpdateHook = function (callback) {
        this.postUpdateHook = callback;
    };
    PluginEditCtrl.prototype.updateAvailable = function () {
        var modalScope = this.$scope.$new(true);
        modalScope.plugin = this.model;
        this.$rootScope.appEvent('show-modal', {
            src: 'public/app/features/plugins/partials/update_instructions.html',
            scope: modalScope,
        });
    };
    PluginEditCtrl.prototype.enable = function () {
        this.model.enabled = true;
        this.model.pinned = true;
        this.update();
    };
    PluginEditCtrl.prototype.disable = function () {
        this.model.enabled = false;
        this.model.pinned = false;
        this.update();
    };
    return PluginEditCtrl;
}());
export { PluginEditCtrl };
angular.module('grafana.controllers').controller('PluginEditCtrl', PluginEditCtrl);
//# sourceMappingURL=plugin_edit_ctrl.js.map