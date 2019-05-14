import angular from 'angular';
import _ from 'lodash';
var pluginInfoCache = {};
var AppPageCtrl = /** @class */ (function () {
    /** @ngInject */
    function AppPageCtrl(backendSrv, $routeParams, $rootScope, navModelSrv) {
        this.backendSrv = backendSrv;
        this.$routeParams = $routeParams;
        this.$rootScope = $rootScope;
        this.navModelSrv = navModelSrv;
        this.pluginId = $routeParams.pluginId;
        if (pluginInfoCache[this.pluginId]) {
            this.initPage(pluginInfoCache[this.pluginId]);
        }
        else {
            this.loadPluginInfo();
        }
    }
    AppPageCtrl.prototype.initPage = function (app) {
        this.appModel = app;
        this.page = _.find(app.includes, { slug: this.$routeParams.slug });
        pluginInfoCache[this.pluginId] = app;
        if (!this.page) {
            this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);
            this.navModel = this.navModelSrv.getNotFoundNav();
            return;
        }
        var pluginNav = this.navModelSrv.getNav('plugin-page-' + app.id);
        this.navModel = {
            main: {
                img: app.info.logos.large,
                subTitle: app.name,
                url: '',
                text: this.page.name,
                breadcrumbs: [{ title: app.name, url: pluginNav.main.url }],
            },
        };
    };
    AppPageCtrl.prototype.loadPluginInfo = function () {
        var _this = this;
        this.backendSrv.get("/api/plugins/" + this.pluginId + "/settings").then(function (app) {
            _this.initPage(app);
        });
    };
    return AppPageCtrl;
}());
export { AppPageCtrl };
angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);
//# sourceMappingURL=plugin_page_ctrl.js.map