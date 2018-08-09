import _ from 'lodash';
import config from 'app/core/config';
import * as dateMath from 'app/core/utils/datemath';
import { angularMocks, sinon } from '../lib/common';
import { PanelModel } from 'app/features/dashboard/panel_model';

export function ControllerTestContext() {
  var self = this;

  this.datasource = {};
  this.$element = {};
  this.$sanitize = {};
  this.annotationsSrv = {};
  this.contextSrv = {};
  this.timeSrv = new TimeSrvStub();
  this.templateSrv = new TemplateSrvStub();
  this.datasourceSrv = {
    getMetricSources: function() {},
    get: function() {
      return {
        then: function(callback) {
          callback(self.datasource);
        },
      };
    },
  };
  this.isUtc = false;

  this.providePhase = function(mocks) {
    return angularMocks.module(function($provide) {
      $provide.value('contextSrv', self.contextSrv);
      $provide.value('datasourceSrv', self.datasourceSrv);
      $provide.value('annotationsSrv', self.annotationsSrv);
      $provide.value('timeSrv', self.timeSrv);
      $provide.value('templateSrv', self.templateSrv);
      $provide.value('$element', self.$element);
      $provide.value('$sanitize', self.$sanitize);
      _.each(mocks, function(value, key) {
        $provide.value(key, value);
      });
    });
  };

  this.createPanelController = function(Ctrl) {
    return angularMocks.inject(function($controller, $rootScope, $q, $location, $browser) {
      self.scope = $rootScope.$new();
      self.$location = $location;
      self.$browser = $browser;
      self.$q = $q;
      self.panel = new PanelModel({ type: 'test' });
      self.dashboard = { meta: {} };
      self.isUtc = false;
      self.dashboard.isTimezoneUtc = function() {
        return self.isUtc;
      };

      $rootScope.appEvent = sinon.spy();
      $rootScope.onAppEvent = sinon.spy();
      $rootScope.colors = [];

      for (var i = 0; i < 50; i++) {
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

  this.createControllerPhase = function(controllerName) {
    return angularMocks.inject(function($controller, $rootScope, $q, $location, $browser) {
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
      for (var i = 0; i < 50; i++) {
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

  this.setIsUtc = function(isUtc = false) {
    self.isUtc = isUtc;
  };
}

export function ServiceTestContext() {
  var self = this;
  self.templateSrv = new TemplateSrvStub();
  self.timeSrv = new TimeSrvStub();
  self.datasourceSrv = {};
  self.backendSrv = {};
  self.$routeParams = {};

  this.providePhase = function(mocks) {
    return angularMocks.module(function($provide) {
      _.each(mocks, function(key) {
        $provide.value(key, self[key]);
      });
    });
  };

  this.createService = function(name) {
    return angularMocks.inject(function($q, $rootScope, $httpBackend, $injector, $location, $timeout) {
      self.$q = $q;
      self.$rootScope = $rootScope;
      self.$httpBackend = $httpBackend;
      self.$location = $location;

      self.$rootScope.onAppEvent = function() {};
      self.$rootScope.appEvent = function() {};
      self.$timeout = $timeout;

      self.service = $injector.get(name);
    });
  };
}

export function DashboardViewStateStub() {
  this.registerPanel = function() {};
}

export function TimeSrvStub() {
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

  this.replace = function(target) {
    return target;
  };

  this.setTime = function(time) {
    this.time = time;
  };
}

export function ContextSrvStub() {
  this.hasRole = function() {
    return true;
  };
}

export function TemplateSrvStub() {
  this.variables = [];
  this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
  this.data = {};
  this.replace = function(text) {
    return _.template(text, this.templateSettings)(this.data);
  };
  this.init = function() {};
  this.getAdhocFilters = function() {
    return [];
  };
  this.fillVariableValuesForUrl = function() {};
  this.updateTemplateData = function() {};
  this.variableExists = function() {
    return false;
  };
  this.variableInitialized = function() {};
  this.highlightVariablesAsHtml = function(str) {
    return str;
  };
  this.setGrafanaVariable = function(name, value) {
    this.data[name] = value;
  };
}

var allDeps = {
  ContextSrvStub,
  TemplateSrvStub,
  TimeSrvStub,
  ControllerTestContext,
  ServiceTestContext,
  DashboardViewStateStub,
};

// for legacy
export default allDeps;
