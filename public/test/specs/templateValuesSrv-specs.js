define([
  '../mocks/dashboard-mock',
  './helpers',
  'moment',
  'app/features/templating/templateValuesSrv'
], function(dashboardMock, helpers, moment) {
  'use strict';

  describe('templateValuesSrv', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['datasourceSrv', 'timeSrv', 'templateSrv', '$location']));
    beforeEach(ctx.createService('templateValuesSrv'));

    describe('update interval variable options', function() {
      var variable = { type: 'interval', query: 'auto,1s,2h,5h,1d', name: 'test' };

      beforeEach(function() {
        ctx.service.updateOptions(variable);
      });

      it('should update options array', function() {
        expect(variable.options.length).to.be(5);
        expect(variable.options[1].text).to.be('1s');
        expect(variable.options[1].value).to.be('1s');
      });
    });

    describe('when template variable is present in url', function() {
      var variable = {
        name: 'apps',
        current: {text: "test", value: "test"},
        options: [{text: "test", value: "test"}]
      };

      beforeEach(function() {
        var dashboard = { templating: { list: [variable] } };
        var urlParams = {};
        urlParams["var-apps"] = "new";
        ctx.$location.search = sinon.stub().returns(urlParams);
        ctx.service.init(dashboard);
      });

      it('should update current value', inject(function($rootScope) {
        $rootScope.$apply();
        expect(variable.current.value).to.be("new");
        expect(variable.current.text).to.be("new");
      }));
    });

    describe('when template variable is present in url multiple times', function() {
      var variable = {
        name: 'apps',
        multi: true,
        current: {text: "val1", value: "val1"},
        options: [{text: "val1", value: "val1"}, {text: 'val2', value: 'val2'}, {text: 'val3', value: 'val3', selected: true}]
      };

      beforeEach(function() {
        var dashboard = { templating: { list: [variable] } };
        var urlParams = {};
        urlParams["var-apps"] = ["val2", "val1"];
        ctx.$location.search = sinon.stub().returns(urlParams);
        ctx.service.init(dashboard);
      });

      it('should update current value', inject(function($rootScope) {
        $rootScope.$apply();
        expect(variable.current.value.length).to.be(2);
        expect(variable.current.value[0]).to.be("val2");
        expect(variable.current.value[1]).to.be("val1");
        expect(variable.current.text).to.be("val2 + val1");
        expect(variable.options[0].selected).to.be(true);
        expect(variable.options[1].selected).to.be(true);
      }));

      it('should set options that are not in value to selected false', inject(function($rootScope) {
        $rootScope.$apply();
        expect(variable.options[2].selected).to.be(false);
      }));
    });

    function describeUpdateVariable(desc, fn) {
      describe(desc, function() {
        var scenario = {};
        scenario.setup = function(setupFn) {
          scenario.setupFn = setupFn;
        };

        beforeEach(function() {
          scenario.setupFn();
          var ds = {};
          ds.metricFindQuery = sinon.stub().returns(ctx.$q.when(scenario.queryResult));
          ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));

          ctx.service.updateOptions(scenario.variable);
          ctx.$rootScope.$digest();
        });

        fn(scenario);
      });
    }

    describeUpdateVariable('interval variable without auto', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'interval', query: '1s,2h,5h,1d', name: 'test' };
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(4);
        expect(scenario.variable.options[0].text).to.be('1s');
        expect(scenario.variable.options[0].value).to.be('1s');
      });
    });

    describeUpdateVariable('query variable with empty current object and refresh', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: '', name: 'test', current: {} };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should set current value to first option', function() {
        expect(scenario.variable.options.length).to.be(2);
        expect(scenario.variable.current.value).to.be('backend1');
      });
    });

    describeUpdateVariable('interval variable without auto', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'interval', query: '1s,2h,5h,1d', name: 'test' };
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(4);
        expect(scenario.variable.options[0].text).to.be('1s');
        expect(scenario.variable.options[0].value).to.be('1s');
      });
    });


    describeUpdateVariable('interval variable with auto', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'interval', query: '1s,2h,5h,1d', name: 'test', auto: true, auto_count: 10 };

        var range = {
          from: moment(new Date()).subtract(7, 'days').toDate(),
          to: new Date()
        };

        ctx.timeSrv.timeRange = sinon.stub().returns(range);
        ctx.templateSrv.setGrafanaVariable = sinon.spy();
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(5);
        expect(scenario.variable.options[0].text).to.be('auto');
        expect(scenario.variable.options[0].value).to.be('$__auto_interval');
      });

      it('should set $__auto_interval', function() {
        var call = ctx.templateSrv.setGrafanaVariable.getCall(0);
        expect(call.args[0]).to.be('$__auto_interval');
        expect(call.args[1]).to.be('12h');
      });
    });

    describeUpdateVariable('update custom variable', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'custom', query: 'hej, hop, asd', name: 'test'};
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(3);
        expect(scenario.variable.options[0].text).to.be('hej');
        expect(scenario.variable.options[1].value).to.be('hop');
      });

      it('should set $__auto_interval', function() {
        var call = ctx.templateSrv.setGrafanaVariable.getCall(0);
        expect(call.args[0]).to.be('$__auto_interval');
        expect(call.args[1]).to.be('12h');
      });
    });

    describeUpdateVariable('basic query variable', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(2);
        expect(scenario.variable.options[0].text).to.be('backend1');
        expect(scenario.variable.options[0].value).to.be('backend1');
        expect(scenario.variable.options[1].value).to.be('backend2');
      });

      it('should select first option as value', function() {
        expect(scenario.variable.current.value).to.be('backend1');
      });
    });

    describeUpdateVariable('and existing value still exists in options', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.current = { value: 'backend2', text: 'backend2'};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(scenario.variable.current.text).to.be('backend2');
      });
    });

    describeUpdateVariable('and regex pattern exists', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = '/apps.*(backend_[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should extract and use match group', function() {
        expect(scenario.variable.options[0].value).to.be('backend_01');
      });
    });

    describeUpdateVariable('and regex pattern exists and no match', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = '/apps.*(backendasd[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should not add non matching items, None option should be added instead', function() {
        expect(scenario.variable.options.length).to.be(1);
        expect(scenario.variable.options[0].isNone).to.be(true);
      });
    });

   describeUpdateVariable('regex pattern without slashes', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = 'backend_01';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

   describeUpdateVariable('regex pattern remove duplicates', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test' };
        scenario.variable.regex = 'backend_01';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_01.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

    describeUpdateVariable('with include All glob syntax', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All Glob option', function() {
        expect(scenario.variable.options[0].value).to.be('{backend1,backend2,backend3}');
      });
    });

    describeUpdateVariable('with include all wildcard', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all wildcard', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'regex wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('.*');
      });
    });

    describeUpdateVariable('with include all regex values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'wildcard' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All wildcard option', function() {
        expect(scenario.variable.options[0].value).to.be('*');
      });
    });

    describeUpdateVariable('with include all glob no values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'glob' };
        scenario.queryResult = [];
      });

      it('should add empty glob', function() {
        expect(scenario.variable.options[0].value).to.be('{}');
      });
    });

    describeUpdateVariable('with include all lucene and values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'lucene' };
        scenario.queryResult = [{text: 'backend1'}, { text: 'backend2'}];
      });

      it('should add lucene glob', function() {
        expect(scenario.variable.options[0].value).to.be('(\\\"backend1\\\" OR \\\"backend2\\\")');
      });
    });

    describeUpdateVariable('with include all regex all values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'regex values' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add empty glob', function() {
        expect(scenario.variable.options[0].value).to.be('(backend1|backend2|backend3)');
      });
    });

    describeUpdateVariable('with include all regex values and values require escaping', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'regex values' };
        scenario.queryResult = [{text: '/root'}, {text: '/var'}, { text: '/lib'}];
      });

      it('should regex escape options', function() {
        expect(scenario.variable.options[0].value).to.be('(\\/lib|\\/root|\\/var)');
        expect(scenario.variable.options[1].value).to.be('\\/lib');
        expect(scenario.variable.options[1].text).to.be('/lib');
      });
    });

    describeUpdateVariable('with include all pipe all values', function(scenario) {
      scenario.setup(function() {
        scenario.variable = { type: 'query', query: 'apps.*', name: 'test', includeAll: true, allFormat: 'pipe' };
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add pipe delimited string', function() {
        expect(scenario.variable.options[0].value).to.be('backend1|backend2|backend3');
      });
    });

  });

});
