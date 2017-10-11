import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import '../all';

import moment from 'moment';
import helpers from 'test/specs/helpers';
import {Emitter} from 'app/core/core';

describe('VariableSrv', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(angularMocks.module('grafana.services'));

  beforeEach(ctx.providePhase(['datasourceSrv', 'timeSrv', 'templateSrv', '$location']));
  beforeEach(angularMocks.inject(($rootScope, $q, $location, $injector) => {
    ctx.$q = $q;
    ctx.$rootScope = $rootScope;
    ctx.$location = $location;
    ctx.variableSrv = $injector.get('variableSrv');
    ctx.variableSrv.init({
      templating: {list: []},
      events: new Emitter(),
      updateSubmenuVisibility: sinon.stub(),
    });
    ctx.$rootScope.$digest();
  }));

  function describeUpdateVariable(desc, fn) {
    describe(desc, function() {
      var scenario: any = {};
      scenario.setup = function(setupFn) {
        scenario.setupFn = setupFn;
      };

      beforeEach(function() {
        scenario.setupFn();
        var ds: any = {};
        ds.metricFindQuery = sinon.stub().returns(ctx.$q.when(scenario.queryResult));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));
        ctx.datasourceSrv.getMetricSources = sinon.stub().returns(scenario.metricSources);


        scenario.variable = ctx.variableSrv.createVariableFromModel(scenario.variableModel);
        ctx.variableSrv.addVariable(scenario.variable);

        ctx.variableSrv.updateOptions(scenario.variable);
        ctx.$rootScope.$digest();
      });

      fn(scenario);
    });
  }

  describeUpdateVariable('interval variable without auto', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {type: 'interval', query: '1s,2h,5h,1d', name: 'test'};
    });

    it('should update options array', () => {
      expect(scenario.variable.options.length).to.be(4);
      expect(scenario.variable.options[0].text).to.be('1s');
      expect(scenario.variable.options[0].value).to.be('1s');
    });
  });

  //
  // Interval variable update
  //
  describeUpdateVariable('interval variable with auto', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {type: 'interval', query: '1s,2h,5h,1d', name: 'test', auto: true, auto_count: 10 };

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

  //
  // Query variable update
  //
  describeUpdateVariable('query variable with empty current object and refresh', function(scenario) {
    scenario.setup(function() {
      scenario.variableModel = {type: 'query', query: '', name: 'test', current: {}};
      scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
    });

    it('should set current value to first option', function() {
      expect(scenario.variable.options.length).to.be(2);
      expect(scenario.variable.current.value).to.be('backend1');
    });
  });

  describeUpdateVariable('query variable with multi select and new options does not contain some selected values', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {
          type: 'query',
          query: '',
          name: 'test',
          current: {
            value: ['val1', 'val2', 'val3'],
            text: 'val1 + val2 + val3'
          }
        };
        scenario.queryResult = [{text: 'val2'}, {text: 'val3'}];
      });

      it('should update current value', function() {
        expect(scenario.variable.current.value).to.eql(['val2', 'val3']);
        expect(scenario.variable.current.text).to.eql('val2 + val3');
      });
    });

    describeUpdateVariable('query variable with multi select and new options does not contain any selected values', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {
          type: 'query',
          query: '',
          name: 'test',
          current: {
            value: ['val1', 'val2', 'val3'],
            text: 'val1 + val2 + val3'
          }
        };
        scenario.queryResult = [{text: 'val5'}, {text: 'val6'}];
      });

      it('should update current value with first one', function() {
        expect(scenario.variable.current.value).to.eql('val5');
        expect(scenario.variable.current.text).to.eql('val5');
      });
    });

    describeUpdateVariable('query variable with multi select and $__all selected', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {
          type: 'query',
          query: '',
          name: 'test',
          includeAll: true,
          current: {
            value: ['$__all'],
            text: 'All'
          }
        };
        scenario.queryResult = [{text: 'val5'}, {text: 'val6'}];
      });

      it('should keep current All value', function() {
        expect(scenario.variable.current.value).to.eql(['$__all']);
        expect(scenario.variable.current.text).to.eql('All');
      });
    });

    describeUpdateVariable('query variable with numeric results', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = { type: 'query', query: '', name: 'test', current: {} };
        scenario.queryResult = [{text: 12, value: 12}];
      });

      it('should set current value to first option', function() {
        expect(scenario.variable.current.value).to.be('12');
        expect(scenario.variable.options[0].value).to.be('12');
        expect(scenario.variable.options[0].text).to.be('12');
      });
    });

    describeUpdateVariable('basic query variable', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
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
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test'};
        scenario.variableModel.current = { value: 'backend2', text: 'backend2'};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}];
      });

      it('should keep variable value', function() {
        expect(scenario.variable.current.text).to.be('backend2');
      });
    });

    describeUpdateVariable('and regex pattern exists', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test'};
        scenario.variableModel.regex = '/apps.*(backend_[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should extract and use match group', function() {
        expect(scenario.variable.options[0].value).to.be('backend_01');
      });
    });

    describeUpdateVariable('and regex pattern exists and no match', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test'};
        scenario.variableModel.regex = '/apps.*(backendasd[0-9]+)/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should not add non matching items, None option should be added instead', function() {
        expect(scenario.variable.options.length).to.be(1);
        expect(scenario.variable.options[0].isNone).to.be(true);
      });
    });

    describeUpdateVariable('regex pattern without slashes', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test'};
        scenario.variableModel.regex = 'backend_01';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_02.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

    describeUpdateVariable('regex pattern remove duplicates', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test'};
        scenario.variableModel.regex = '/backend_01/';
        scenario.queryResult = [{text: 'apps.backend.backend_01.counters.req'}, {text: 'apps.backend.backend_01.counters.req'}];
      });

      it('should return matches options', function() {
        expect(scenario.variable.options.length).to.be(1);
      });
    });

    describeUpdateVariable('with include All', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', includeAll: true};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All option', function() {
        expect(scenario.variable.options[0].text).to.be('All');
        expect(scenario.variable.options[0].value).to.be('$__all');
      });
    });

    describeUpdateVariable('with include all and custom value', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', includeAll: true, allValue: '*'};
        scenario.queryResult = [{text: 'backend1'}, {text: 'backend2'}, { text: 'backend3'}];
      });

      it('should add All option with custom value', function() {
        expect(scenario.variable.options[0].value).to.be('$__all');
      });
    });

    describeUpdateVariable('without sort', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', sort: 0};
        scenario.queryResult = [{text: 'bbb2'}, {text: 'aaa10'}, { text: 'ccc3'}];
      });

      it('should return options without sort', function() {
        expect(scenario.variable.options[0].text).to.be('bbb2');
        expect(scenario.variable.options[1].text).to.be('aaa10');
        expect(scenario.variable.options[2].text).to.be('ccc3');
      });
    });

    describeUpdateVariable('with alphabetical sort (asc)', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', sort: 1};
        scenario.queryResult = [{text: 'bbb2'}, {text: 'aaa10'}, { text: 'ccc3'}];
      });

      it('should return options with alphabetical sort', function() {
        expect(scenario.variable.options[0].text).to.be('aaa10');
        expect(scenario.variable.options[1].text).to.be('bbb2');
        expect(scenario.variable.options[2].text).to.be('ccc3');
      });
    });

    describeUpdateVariable('with alphabetical sort (desc)', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', sort: 2};
        scenario.queryResult = [{text: 'bbb2'}, {text: 'aaa10'}, { text: 'ccc3'}];
      });

      it('should return options with alphabetical sort', function() {
        expect(scenario.variable.options[0].text).to.be('ccc3');
        expect(scenario.variable.options[1].text).to.be('bbb2');
        expect(scenario.variable.options[2].text).to.be('aaa10');
      });
    });

    describeUpdateVariable('with numerical sort (asc)', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', sort: 3};
        scenario.queryResult = [{text: 'bbb2'}, {text: 'aaa10'}, { text: 'ccc3'}];
      });

      it('should return options with numerical sort', function() {
        expect(scenario.variable.options[0].text).to.be('bbb2');
        expect(scenario.variable.options[1].text).to.be('ccc3');
        expect(scenario.variable.options[2].text).to.be('aaa10');
      });
    });

    describeUpdateVariable('with numerical sort (desc)', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'query', query: 'apps.*', name: 'test', sort: 4};
        scenario.queryResult = [{text: 'bbb2'}, {text: 'aaa10'}, { text: 'ccc3'}];
      });

      it('should return options with numerical sort', function() {
        expect(scenario.variable.options[0].text).to.be('aaa10');
        expect(scenario.variable.options[1].text).to.be('ccc3');
        expect(scenario.variable.options[2].text).to.be('bbb2');
      });
    });

    //
    // datasource variable update
    //
    describeUpdateVariable('datasource variable with regex filter', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {
          type: 'datasource',
          query: 'graphite',
          name: 'test',
          current: {value: 'backend4_pee', text: 'backend4_pee'},
          regex: '/pee$/'
        };
        scenario.metricSources = [
          {name: 'backend1', meta: {id: 'influx'}},
          {name: 'backend2_pee', meta: {id: 'graphite'}},
          {name: 'backend3', meta: {id: 'graphite'}},
          {name: 'backend4_pee', meta: {id: 'graphite'}},
        ];
      });

      it('should set only contain graphite ds and filtered using regex', function() {
        expect(scenario.variable.options.length).to.be(2);
        expect(scenario.variable.options[0].value).to.be('backend2_pee');
        expect(scenario.variable.options[1].value).to.be('backend4_pee');
      });

      it('should keep current value if available', function() {
        expect(scenario.variable.current.value).to.be('backend4_pee');
      });
    });

    //
    // Custom variable update
    //
    describeUpdateVariable('update custom variable', function(scenario) {
      scenario.setup(function() {
        scenario.variableModel = {type: 'custom', query: 'hej, hop, asd', name: 'test'};
      });

      it('should update options array', function() {
        expect(scenario.variable.options.length).to.be(3);
        expect(scenario.variable.options[0].text).to.be('hej');
        expect(scenario.variable.options[1].value).to.be('hop');
      });
    });
});
