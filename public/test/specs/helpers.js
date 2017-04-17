define([
 'lodash',
 'app/core/utils/datemath',
], function(_, dateMath) {
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

    this.createControllerPhase = function(controllerName) {
      return inject(function($controller, $rootScope, $q, $location, $browser) {
        self.scope = $rootScope.$new();
        self.$location = $location;
        self.$browser = $browser;
        self.scope.contextSrv = {};
        self.scope.panel = {};
        self.scope.row = { panels:[] };
        self.scope.dashboard = {};
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
    self.$location = {};
    self.$routeParams = {};

    this.providePhase = function(mocks) {
     return module(function($provide) {
       _.each(mocks, function(key) {
         $provide.value(key, self[key]);
       });
      });
    };

    this.createService = function(name) {
      return inject(function($q, $rootScope, $httpBackend, $injector) {
        self.$q = $q;
        self.$rootScope = $rootScope;
        self.$httpBackend =  $httpBackend;

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
      return _.template(text, this.data,  this.templateSettings);
    };
    this.init = function() {};
    this.fillVariableValuesForUrl = function() {};
    this.updateTemplateData = function() { };
    this.variableExists = function() { return false; };
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
