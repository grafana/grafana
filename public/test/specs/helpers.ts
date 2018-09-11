import _ from 'lodash';
import config from 'app/core/config';
import * as dateMath from 'app/core/utils/datemath';
import { angularMocks, sinon } from '../lib/common';
import { PanelModel } from 'app/features/dashboard/panel_model';

export function ControllerTestContext(this: any) {
  const self = this;

  this.datasource = {};
  this.$element = {};
  this.$sanitize = {};
  this.annotationsSrv = {};
  this.contextSrv = {};
  this.timeSrv = new TimeSrvStub();
  this.templateSrv = new TemplateSrvStub();
  this.datasourceSrv = {
    getMetricSources: () => {},
    get: () => {
      return {
        then: callback => {
          callback(self.datasource);
        },
      };
    },
  };
  this.isUtc = false;

  this.providePhase = mocks => {
    return angularMocks.module($provide => {
      $provide.value('contextSrv', self.contextSrv);
      $provide.value('datasourceSrv', self.datasourceSrv);
      $provide.value('annotationsSrv', self.annotationsSrv);
      $provide.value('timeSrv', self.timeSrv);
      $provide.value('templateSrv', self.templateSrv);
      $provide.value('$element', self.$element);
      $provide.value('$sanitize', self.$sanitize);
      _.each(mocks, (value, key) => {
        $provide.value(key, value);
      });
    });
  };

  this.createPanelController = Ctrl => {
    return angularMocks.inject(($controller, $rootScope, $q, $location, $browser) => {
      self.scope = $rootScope.$new();
      self.$location = $location;
      self.$browser = $browser;
      self.$q = $q;
      self.panel = new PanelModel({ type: 'test' });
      self.dashboard = { meta: {} };
      self.isUtc = false;
      self.dashboard.isTimezoneUtc = () => {
        return self.isUtc;
      };

      $rootScope.appEvent = sinon.spy();
      $rootScope.onAppEvent = sinon.spy();
      $rootScope.colors = [];

      for (let i = 0; i < 50; i++) {
        $rootScope.colors.push('#' + i);
      }

      config.panels['test'] = { info: {} };
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

  this.createControllerPhase = controllerName => {
    return angularMocks.inject(($controller, $rootScope, $q, $location, $browser) => {
      self.scope = $rootScope.$new();
      self.$location = $location;
      self.$browser = $browser;
      self.scope.contextSrv = {};
      self.scope.panel = {};
      self.scope.dashboard = { meta: {} };
      self.scope.dashboardMeta = {};
      self.scope.dashboardViewState = new DashboardViewStateStub();
      self.scope.appEvent = sinon.spy();
      self.scope.onAppEvent = sinon.spy();

      $rootScope.colors = [];
      for (let i = 0; i < 50; i++) {
        $rootScope.colors.push('#' + i);
      }

      self.$q = $q;
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

export function ServiceTestContext(this: any) {
  const self = this;
  self.templateSrv = new TemplateSrvStub();
  self.timeSrv = new TimeSrvStub();
  self.datasourceSrv = {};
  self.backendSrv = {};
  self.$routeParams = {};

  this.providePhase = mocks => {
    return angularMocks.module($provide => {
      _.each(mocks, key => {
        $provide.value(key, self[key]);
      });
    });
  };

  this.createService = name => {
    return angularMocks.inject(($q, $rootScope, $httpBackend, $injector, $location, $timeout) => {
      self.$q = $q;
      self.$rootScope = $rootScope;
      self.$httpBackend = $httpBackend;
      self.$location = $location;

      self.$rootScope.onAppEvent = () => {};
      self.$rootScope.appEvent = () => {};
      self.$timeout = $timeout;

      self.service = $injector.get(name);
    });
  };
}

export function DashboardViewStateStub(this: any) {
  this.registerPanel = () => {};
}

export function TimeSrvStub(this: any) {
  this.init = sinon.spy();
  this.time = { from: 'now-1h', to: 'now' };
  this.timeRange = function(parse) {
    if (parse === false) {
      return this.time;
    }
    return {
      from: dateMath.parse(this.time.from, false),
      to: dateMath.parse(this.time.to, true),
    };
  };

  this.replace = target => {
    return target;
  };

  this.setTime = function(time) {
    this.time = time;
  };
}

export function ContextSrvStub(this: any) {
  this.hasRole = () => {
    return true;
  };
}

export function TemplateSrvStub(this: any) {
  this.variables = [];
  this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
  this.data = {};
  this.replace = function(text) {
    return _.template(text, this.templateSettings)(this.data);
  };
  this.init = () => {};
  this.getAdhocFilters = () => {
    return [];
  };
  this.fillVariableValuesForUrl = () => {};
  this.updateTemplateData = () => {};
  this.variableExists = () => {
    return false;
  };
  this.variableInitialized = () => {};
  this.highlightVariablesAsHtml = str => {
    return str;
  };
  this.setGrafanaVariable = function(name, value) {
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
