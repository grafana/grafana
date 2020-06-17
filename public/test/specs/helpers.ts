import each from 'lodash/each';
import template from 'lodash/template';

import config from 'app/core/config';
import { dateMath } from '@grafana/data';
import { angularMocks, sinon } from '../lib/common';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { RawTimeRange } from '@grafana/data';
import { PanelPluginMeta } from '@grafana/data';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

export function ControllerTestContext(this: any) {
  const self = this;

  this.datasource = {};
  this.$element = {};
  this.$sanitize = {};
  this.annotationsSrv = {};
  this.contextSrv = {};
  this.timeSrv = new TimeSrvStub();
  this.templateSrv = TemplateSrvStub();
  this.datasourceSrv = {
    getMetricSources: () => {},
    get: () => {
      return {
        then: (callback: (ds: any) => void) => {
          callback(self.datasource);
        },
      };
    },
  };
  this.isUtc = false;

  this.providePhase = (mocks: any) => {
    return angularMocks.module(($provide: any) => {
      $provide.value('contextSrv', self.contextSrv);
      $provide.value('datasourceSrv', self.datasourceSrv);
      $provide.value('annotationsSrv', self.annotationsSrv);
      $provide.value('timeSrv', self.timeSrv);
      $provide.value('templateSrv', self.templateSrv);
      $provide.value('$element', self.$element);
      $provide.value('$sanitize', self.$sanitize);
      each(mocks, (value: any, key: any) => {
        $provide.value(key, value);
      });
    });
  };

  this.createPanelController = (Ctrl: any) => {
    return angularMocks.inject(($controller: any, $rootScope: GrafanaRootScope, $location: any, $browser: any) => {
      self.scope = $rootScope.$new();
      self.$location = $location;
      self.$browser = $browser;
      self.panel = new PanelModel({ type: 'test' });
      self.dashboard = { meta: {} };
      self.isUtc = false;
      self.dashboard.getTimezone = () => {
        return self.isUtc ? 'utc' : 'browser';
      };

      $rootScope.appEvent = sinon.spy();
      $rootScope.onAppEvent = sinon.spy();
      $rootScope.colors = [];

      for (let i = 0; i < 50; i++) {
        $rootScope.colors.push('#' + i);
      }

      config.panels['test'] = { info: {} } as PanelPluginMeta;
      self.ctrl = $controller(
        Ctrl,
        { $scope: self.scope },
        {
          panel: self.panel,
          dashboard: self.dashboard,
        }
      );
    });
  };

  this.createControllerPhase = (controllerName: string) => {
    return angularMocks.inject(($controller: any, $rootScope: GrafanaRootScope, $location: any, $browser: any) => {
      self.scope = $rootScope.$new();
      self.$location = $location;
      self.$browser = $browser;
      self.scope.contextSrv = {};
      self.scope.panel = {};
      self.scope.dashboard = { meta: {} };
      self.scope.dashboardMeta = {};
      self.scope.dashboardViewState = DashboardViewStateStub();
      self.scope.appEvent = sinon.spy();
      self.scope.onAppEvent = sinon.spy();

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

  this.setIsUtc = (isUtc: any = false) => {
    self.isUtc = isUtc;
  };
}

export function ServiceTestContext(this: any) {
  const self = this;
  self.templateSrv = TemplateSrvStub();
  self.timeSrv = new TimeSrvStub();
  self.datasourceSrv = {};
  self.backendSrv = {};
  self.$routeParams = {};

  this.providePhase = (mocks: any) => {
    return angularMocks.module(($provide: any) => {
      each(mocks, (key: string) => {
        $provide.value(key, self[key]);
      });
    });
  };

  this.createService = (name: string) => {
    // @ts-ignore
    return angularMocks.inject(
      ($rootScope: GrafanaRootScope, $httpBackend: any, $injector: any, $location: any, $timeout: any) => {
        self.$rootScope = $rootScope;
        self.$httpBackend = $httpBackend;
        self.$location = $location;

        self.$rootScope.onAppEvent = () => {};
        self.$rootScope.appEvent = () => {};
        self.$timeout = $timeout;

        self.service = $injector.get(name);
      }
    );
  };
}

export function DashboardViewStateStub(this: any) {
  this.registerPanel = () => {};
}

export class TimeSrvStub {
  time: RawTimeRange;

  constructor() {
    this.time = { from: 'now-1h', to: 'now' };
  }

  init() {}

  timeRange(parse: boolean) {
    if (parse === false) {
      return this.time;
    }
    return {
      from: dateMath.parse(this.time.from, false),
      to: dateMath.parse(this.time.to, true),
    };
  }

  setTime(time: any) {
    this.time = time;
  }
}

export class ContextSrvStub {
  isGrafanaVisible = jest.fn();

  getValidInterval() {
    return '10s';
  }

  hasRole() {
    return true;
  }
}

export function TemplateSrvStub(this: any) {
  this.variables = [];
  this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
  this.data = {};
  this.replace = (text: string) => {
    return template(text, this.templateSettings)(this.data);
  };
  this.init = () => {};
  this.getAdhocFilters = (): any => {
    return [];
  };
  this.fillVariableValuesForUrl = () => {};
  this.updateIndex = () => {};
  this.variableExists = () => {
    return false;
  };
  this.variableInitialized = () => {};
  this.highlightVariablesAsHtml = (str: string) => {
    return str;
  };
  this.setGrafanaVariable = function(name: string, value: string) {
    this.data[name] = value;
  };
}

const allDeps = {
  ContextSrvStub,
  TemplateSrvStub,
  TimeSrvStub,
  ControllerTestContext,
  ServiceTestContext,
  DashboardViewStateStub,
};

// for legacy
export default allDeps;
