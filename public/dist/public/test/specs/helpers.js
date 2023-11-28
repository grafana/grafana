import { each, template } from 'lodash';
import { dateMath } from '@grafana/data';
import config from 'app/core/config';
import { ContextSrv } from 'app/core/services/context_srv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { angularMocks } from '../lib/common';
export function ControllerTestContext() {
    const self = this;
    this.datasource = {};
    this.$element = {};
    this.$sanitize = {};
    this.annotationsSrv = {};
    this.contextSrv = {};
    this.timeSrv = new TimeSrvStub();
    this.templateSrv = TemplateSrvStub();
    this.datasourceSrv = {
        getMetricSources: () => { },
        get: () => {
            return {
                then: (callback) => {
                    callback(self.datasource);
                },
            };
        },
    };
    this.isUtc = false;
    this.providePhase = (mocks) => {
        return angularMocks.module(($provide) => {
            $provide.value('contextSrv', self.contextSrv);
            $provide.value('datasourceSrv', self.datasourceSrv);
            $provide.value('annotationsSrv', self.annotationsSrv);
            $provide.value('timeSrv', self.timeSrv);
            $provide.value('templateSrv', self.templateSrv);
            $provide.value('$element', self.$element);
            $provide.value('$sanitize', self.$sanitize);
            each(mocks, (value, key) => {
                $provide.value(key, value);
            });
        });
    };
    this.createPanelController = (Ctrl) => {
        return angularMocks.inject(($controller, $rootScope, $browser) => {
            self.scope = $rootScope.$new();
            self.$browser = $browser;
            self.panel = new PanelModel({ type: 'test' });
            self.dashboard = { meta: {} };
            self.isUtc = false;
            self.dashboard.getTimezone = () => {
                return self.isUtc ? 'utc' : 'browser';
            };
            $rootScope.appEvent = jest.fn();
            $rootScope.onAppEvent = jest.fn();
            $rootScope.colors = [];
            for (let i = 0; i < 50; i++) {
                $rootScope.colors.push('#' + i);
            }
            config.panels['test'] = { info: {} };
            self.ctrl = $controller(Ctrl, { $scope: self.scope }, {
                panel: self.panel,
                dashboard: self.dashboard,
            });
        });
    };
    this.createControllerPhase = (controllerName) => {
        return angularMocks.inject(($controller, $rootScope, $browser) => {
            self.scope = $rootScope.$new();
            self.$browser = $browser;
            self.scope.contextSrv = {};
            self.scope.panel = {};
            self.scope.dashboard = { meta: {} };
            self.scope.dashboardMeta = {};
            self.scope.dashboardViewState = DashboardViewStateStub();
            self.scope.appEvent = jest.fn();
            self.scope.onAppEvent = jest.fn();
            $rootScope.colors = [];
            for (let i = 0; i < 50; i++) {
                $rootScope.colors.push('#' + i);
            }
            self.scope.skipDataOnInit = true;
            self.scope.skipAutoInit = true;
            self.controller = $controller(controllerName, {
                $scope: self.scope,
            });
        });
    };
    this.setIsUtc = (isUtc = false) => {
        self.isUtc = isUtc;
    };
}
export function DashboardViewStateStub() {
    this.registerPanel = () => { };
}
export class TimeSrvStub {
    constructor() {
        this.time = { from: 'now-1h', to: 'now' };
    }
    init() { }
    timeRange(parse) {
        if (parse === false) {
            return this.time;
        }
        return {
            from: dateMath.parse(this.time.from, false),
            to: dateMath.parse(this.time.to, true),
        };
    }
    setTime(time) {
        this.time = time;
    }
}
export class ContextSrvStub extends ContextSrv {
    constructor() {
        super(...arguments);
        this.isGrafanaVisible = jest.fn();
    }
    getValidInterval() {
        return '10s';
    }
    hasRole() {
        return true;
    }
    isAllowedInterval() {
        return true;
    }
}
export function TemplateSrvStub() {
    this.variables = [];
    this.getVariables = function () {
        return this.variables;
    };
    this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
    this.data = {};
    this.replace = (text) => {
        return template(text, this.templateSettings)(this.data);
    };
    this.init = () => { };
    this.getAdhocFilters = () => {
        return [];
    };
    this.fillVariableValuesForUrl = () => { };
    this.updateIndex = () => { };
    this.containsTemplate = () => {
        return false;
    };
    this.variableInitialized = () => { };
    this.highlightVariablesAsHtml = (str) => {
        return str;
    };
    this.setGrafanaVariable = function (name, value) {
        this.data[name] = value;
    };
}
const allDeps = {
    ContextSrvStub,
    TemplateSrvStub,
    TimeSrvStub,
    ControllerTestContext,
    DashboardViewStateStub,
};
// for legacy
export default allDeps;
//# sourceMappingURL=helpers.js.map