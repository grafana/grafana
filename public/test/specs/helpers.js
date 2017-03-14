define([
 'lodash',
 'app/core/config',
 'app/core/utils/datemath',
], function(_, config, dateMath) {
  'use strict';

  function ControllerTestContext() {
    var self = this;

    this.datasource = {};
    this.$element = {};
    this.annotationsSrv = {};
    this.timeSrv = new TimeSrvStub();
    this.templateSrv = new TemplateSrvStub();
    this.datasourceSrv = {
      getMetricSources: function() {},
      get: function() {
        return {
          then: function(callback) {
            callback(self.datasource);
          }
        };
      }
    };

    this.providePhase = function(mocks) {
      return module(function($provide) {
        $provide.value('datasourceSrv', self.datasourceSrv);
        $provide.value('annotationsSrv', self.annotationsSrv);
        $provide.value('timeSrv', self.timeSrv);
        $provide.value('templateSrv', self.templateSrv);
        $provide.value('$element', self.$element);
        _.each(mocks, function(value, key) {
          $provide.value(key, value);
        });
      });
    };

    this.createPanelController = function(Ctrl) {
      return inject(function($controller, $rootScope, $q, $location, $browser) {
        self.scope = $rootScope.$new();
        self.$location = $location;
        self.$browser = $browser;
        self.$q = $q;
        self.panel = {type: 'test'};
        self.dashboard = {meta: {}};

        $rootScope.appEvent = sinon.spy();
        $rootScope.onAppEvent = sinon.spy();
        $rootScope.colors = [];

        for (var i = 0; i < 50; i++) { $rootScope.colors.push('#' + i); }

        config.panels['test'] = {info: {}};
        self.ctrl = $controller(Ctrl, {$scope: self.scope}, {
          panel: self.panel, dashboard: self.dashboard, row: {}
        });
      });
    };

    this.createControllerPhase = function(controllerName) {
      return inject(function($controller, $rootScope, $q, $location, $browser) {
        self.scope = $rootScope.$new();
        self.$location = $location;
        self.$browser = $browser;
        self.scope.contextSrv = {};
        self.scope.panel = {};
        self.scope.row = { panels:[] };
        self.scope.dashboard = {meta: {}};
        self.scope.dashboardMeta = {};
        self.scope.dashboardViewState = new DashboardViewStateStub();
        self.scope.appEvent = sinon.spy();
        self.scope.onAppEvent = sinon.spy();

        $rootScope.colors = [];
        for (var i = 0; i < 50; i++) { $rootScope.colors.push('#' + i); }

        self.$q = $q;
        self.scope.skipDataOnInit = true;
        self.scope.skipAutoInit = true;
        self.controller = $controller(controllerName, {
          $scope: self.scope
        });
      });
    };
  }

  function ServiceTestContext() {
    var self = this;
    self.templateSrv = new TemplateSrvStub();
    self.timeSrv = new TimeSrvStub();
    self.datasourceSrv = {};
    self.backendSrv = {};
    self.$routeParams = {};

    this.providePhase = function(mocks) {
      return module(function($provide) {
        _.each(mocks, function(key) {
          $provide.value(key, self[key]);
        });
      });
    };

    this.createService = function(name) {
      return inject(function($q, $rootScope, $httpBackend, $injector, $location) {
        self.$q = $q;
        self.$rootScope = $rootScope;
        self.$httpBackend =  $httpBackend;
        self.$location = $location;

        self.$rootScope.onAppEvent = function() {};
        self.$rootScope.appEvent = function() {};

        self.service = $injector.get(name);
      });
    };
  }

  function DashboardViewStateStub() {
    this.registerPanel = function() {
    };
  }

  function TimeSrvStub() {
    this.init = sinon.spy();
    this.time = { from:'now-1h', to: 'now'};
    this.timeRange = function(parse) {
      if (parse === false) {
        return this.time;
      }
      return {
        from : dateMath.parse(this.time.from, false),
        to : dateMath.parse(this.time.to, true)
      };
    };

    this.replace = function(target) {
      return target;
    };

    this.setTime = function(time) {
      this.time = time;
    };
  }

  function ContextSrvStub() {
    this.hasRole = function() {
      return true;
    };
  }

  function TemplateSrvStub() {
    this.variables = [];
    this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
    this.data = {};
    this.replace = function(text) {
      return _.template(text, this.templateSettings)(this.data);
    };
    this.init = function() {};
    this.getAdhocFilters = function() { return []; };
    this.fillVariableValuesForUrl = function() {};
    this.updateTemplateData = function() { };
    this.variableExists = function() { return false; };
    this.variableInitialized = function() { };
    this.highlightVariablesAsHtml = function(str) { return str; };
    this.setGrafanaVariable = function(name, value) {
      this.data[name] = value;
    };
  }

  return {
    ControllerTestContext: ControllerTestContext,
    TimeSrvStub: TimeSrvStub,
    ContextSrvStub: ContextSrvStub,
    ServiceTestContext: ServiceTestContext
  };

});
