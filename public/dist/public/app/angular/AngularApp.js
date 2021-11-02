import angular from 'angular';
import 'angular-route';
import 'angular-sanitize';
import 'angular-bindonce';
import 'vendor/bootstrap/bootstrap';
import 'vendor/angular-other/angular-strap';
import { config } from 'app/core/config';
import coreModule, { angularModules } from 'app/core/core_module';
import { DashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { registerAngularDirectives } from 'app/core/core';
import { initAngularRoutingBridge } from 'app/angular/bridgeReactAngularRouting';
import { monkeyPatchInjectorWithPreAssignedBindings } from 'app/core/injectorMonkeyPatch';
import { extend } from 'lodash';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from '@grafana/runtime';
import './panel/all';
import './partials';
var AngularApp = /** @class */ (function () {
    function AngularApp() {
        this.preBootModules = [];
        this.ngModuleDependencies = [];
        this.registerFunctions = {};
    }
    AngularApp.prototype.init = function () {
        var _this = this;
        var app = angular.module('grafana', []);
        app.config(function ($controllerProvider, $compileProvider, $filterProvider, $httpProvider, $provide) {
            if (config.buildInfo.env !== 'development') {
                $compileProvider.debugInfoEnabled(false);
            }
            $httpProvider.useApplyAsync(true);
            _this.registerFunctions.controller = $controllerProvider.register;
            _this.registerFunctions.directive = $compileProvider.directive;
            _this.registerFunctions.factory = $provide.factory;
            _this.registerFunctions.service = $provide.service;
            _this.registerFunctions.filter = $filterProvider.register;
            $provide.decorator('$http', [
                '$delegate',
                '$templateCache',
                function ($delegate, $templateCache) {
                    var get = $delegate.get;
                    $delegate.get = function (url, config) {
                        if (url.match(/\.html$/)) {
                            // some template's already exist in the cache
                            if (!$templateCache.get(url)) {
                                url += '?v=' + new Date().getTime();
                            }
                        }
                        return get(url, config);
                    };
                    return $delegate;
                },
            ]);
        });
        this.ngModuleDependencies = [
            'grafana.core',
            'ngSanitize',
            '$strap.directives',
            'grafana',
            'pasvaz.bindonce',
            'react',
        ];
        // makes it possible to add dynamic stuff
        angularModules.forEach(function (m) {
            _this.useModule(m);
        });
        // register react angular wrappers
        angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);
        coreModule.factory('timeSrv', function () { return getTimeSrv(); });
        coreModule.factory('templateSrv', function () { return getTemplateSrv(); });
        registerAngularDirectives();
        initAngularRoutingBridge();
    };
    AngularApp.prototype.useModule = function (module) {
        if (this.preBootModules) {
            this.preBootModules.push(module);
        }
        else {
            extend(module, this.registerFunctions);
        }
        this.ngModuleDependencies.push(module.name);
        return module;
    };
    AngularApp.prototype.bootstrap = function () {
        var _this = this;
        var injector = angular.bootstrap(document.getElementById('ngRoot'), this.ngModuleDependencies);
        monkeyPatchInjectorWithPreAssignedBindings(injector);
        injector.invoke(function () {
            _this.preBootModules.forEach(function (module) {
                extend(module, _this.registerFunctions);
            });
            // I don't know
            return function () { };
        });
        return injector;
    };
    return AngularApp;
}());
export { AngularApp };
//# sourceMappingURL=AngularApp.js.map