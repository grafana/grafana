import { each, template } from 'lodash';
import config from 'app/core/config';
import { angularMocks, sinon } from '../lib/common';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { dateMath } from '@grafana/data';
export function ControllerTestContext() {
    var self = this;
    this.datasource = {};
    this.$element = {};
    this.$sanitize = {};
    this.annotationsSrv = {};
    this.contextSrv = {};
    this.timeSrv = new TimeSrvStub();
    this.templateSrv = TemplateSrvStub();
    this.datasourceSrv = {
        getMetricSources: function () { },
        get: function () {
            return {
                then: function (callback) {
                    callback(self.datasource);
                },
            };
        },
    };
    this.isUtc = false;
    this.providePhase = function (mocks) {
        return angularMocks.module(function ($provide) {
            $provide.value('contextSrv', self.contextSrv);
            $provide.value('datasourceSrv', self.datasourceSrv);
            $provide.value('annotationsSrv', self.annotationsSrv);
            $provide.value('timeSrv', self.timeSrv);
            $provide.value('templateSrv', self.templateSrv);
            $provide.value('$element', self.$element);
            $provide.value('$sanitize', self.$sanitize);
            each(mocks, function (value, key) {
                $provide.value(key, value);
            });
        });
    };
    this.createPanelController = function (Ctrl) {
        return angularMocks.inject(function ($controller, $rootScope, $browser) {
            self.scope = $rootScope.$new();
            self.$browser = $browser;
            self.panel = new PanelModel({ type: 'test' });
            self.dashboard = { meta: {} };
            self.isUtc = false;
            self.dashboard.getTimezone = function () {
                return self.isUtc ? 'utc' : 'browser';
            };
            $rootScope.appEvent = sinon.spy();
            $rootScope.onAppEvent = sinon.spy();
            $rootScope.colors = [];
            for (var i = 0; i < 50; i++) {
                $rootScope.colors.push('#' + i);
            }
            config.panels['test'] = { info: {} };
            self.ctrl = $controller(Ctrl, { $scope: self.scope }, {
                panel: self.panel,
                dashboard: self.dashboard,
            });
        });
    };
    this.createControllerPhase = function (controllerName) {
        return angularMocks.inject(function ($controller, $rootScope, $browser) {
            self.scope = $rootScope.$new();
            self.$browser = $browser;
            self.scope.contextSrv = {};
            self.scope.panel = {};
            self.scope.dashboard = { meta: {} };
            self.scope.dashboardMeta = {};
            self.scope.dashboardViewState = DashboardViewStateStub();
            self.scope.appEvent = sinon.spy();
            self.scope.onAppEvent = sinon.spy();
            $rootScope.colors = [];
            for (var i = 0; i < 50; i++) {
                $rootScope.colors.push('#' + i);
            }
            self.scope.skipDataOnInit = true;
            self.scope.skipAutoInit = true;
            self.controller = $controller(controllerName, {
                $scope: self.scope,
            });
        });
    };
    this.setIsUtc = function (isUtc) {
        if (isUtc === void 0) { isUtc = false; }
        self.isUtc = isUtc;
    };
}
export function DashboardViewStateStub() {
    this.registerPanel = function () { };
}
var TimeSrvStub = /** @class */ (function () {
    function TimeSrvStub() {
        this.time = { from: 'now-1h', to: 'now' };
    }
    TimeSrvStub.prototype.init = function () { };
    TimeSrvStub.prototype.timeRange = function (parse) {
        if (parse === false) {
            return this.time;
        }
        return {
            from: dateMath.parse(this.time.from, false),
            to: dateMath.parse(this.time.to, true),
        };
    };
    TimeSrvStub.prototype.setTime = function (time) {
        this.time = time;
    };
    return TimeSrvStub;
}());
export { TimeSrvStub };
var ContextSrvStub = /** @class */ (function () {
    function ContextSrvStub() {
        this.isGrafanaVisible = jest.fn();
    }
    ContextSrvStub.prototype.getValidInterval = function () {
        return '10s';
    };
    ContextSrvStub.prototype.hasRole = function () {
        return true;
    };
    ContextSrvStub.prototype.isAllowedInterval = function () {
        return true;
    };
    return ContextSrvStub;
}());
export { ContextSrvStub };
export function TemplateSrvStub() {
    var _this = this;
    this.variables = [];
    this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
    this.data = {};
    this.replace = function (text) {
        return template(text, _this.templateSettings)(_this.data);
    };
    this.init = function () { };
    this.getAdhocFilters = function () {
        return [];
    };
    this.fillVariableValuesForUrl = function () { };
    this.updateIndex = function () { };
    this.variableExists = function () {
        return false;
    };
    this.variableInitialized = function () { };
    this.highlightVariablesAsHtml = function (str) {
        return str;
    };
    this.setGrafanaVariable = function (name, value) {
        this.data[name] = value;
    };
}
var allDeps = {
    ContextSrvStub: ContextSrvStub,
    TemplateSrvStub: TemplateSrvStub,
    TimeSrvStub: TimeSrvStub,
    ControllerTestContext: ControllerTestContext,
    DashboardViewStateStub: DashboardViewStateStub,
};
// for legacy
export default allDeps;
//# sourceMappingURL=helpers.js.map