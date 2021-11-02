import angular from 'angular';
import { find } from 'lodash';
import { getPluginSettings } from './PluginSettingsCache';
import { AppEvents } from '@grafana/data';
import { promiseToDigest } from '../../core/utils/promiseToDigest';
var AppPageCtrl = /** @class */ (function () {
    /** @ngInject */
    function AppPageCtrl($routeParams, $rootScope, navModelSrv) {
        var _this = this;
        this.$routeParams = $routeParams;
        this.$rootScope = $rootScope;
        this.navModelSrv = navModelSrv;
        this.pluginId = $routeParams.pluginId;
        promiseToDigest($rootScope)(Promise.resolve(getPluginSettings(this.pluginId))
            .then(function (settings) {
            _this.initPage(settings);
        })
            .catch(function (err) {
            _this.$rootScope.appEvent(AppEvents.alertError, ['Unknown Plugin']);
            _this.navModel = _this.navModelSrv.getNotFoundNav();
        }));
    }
    AppPageCtrl.prototype.initPage = function (app) {
        this.appModel = app;
        this.page = find(app.includes, { slug: this.$routeParams.slug });
        if (!this.page) {
            this.$rootScope.appEvent(AppEvents.alertError, ['App Page Not Found']);
            this.navModel = this.navModelSrv.getNotFoundNav();
            return;
        }
        if (app.type !== 'app' || !app.enabled) {
            this.$rootScope.appEvent(AppEvents.alertError, ['Application Not Enabled']);
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
    return AppPageCtrl;
}());
export { AppPageCtrl };
angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);
//# sourceMappingURL=plugin_page_ctrl.js.map