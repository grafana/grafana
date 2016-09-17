import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import _ from 'lodash';
import helpers from 'test/specs/helpers';
import '../all';

describe('VariableSrv init', function() {
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
    ctx.variableSrv.init({templating: {list: []}});
    ctx.$rootScope.$digest();
  }));

  function describeInitScenario(desc, fn) {
    describe(desc, function() {
      var scenario: any = {
        urlParams: {},
        setup: setupFn => {
          scenario.setupFn = setupFn;
        }
      };

      beforeEach(function() {
        scenario.setupFn();
        ctx.datasource = {};
        ctx.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when(scenario.queryResult));

        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ctx.datasource));
        ctx.datasourceSrv.getMetricSources = sinon.stub().returns(scenario.metricSources);

        ctx.$location.search = sinon.stub().returns(scenario.urlParams);

        ctx.dashboard = {templating: {list: scenario.variables}};
        ctx.variableSrv.init(ctx.dashboard);
        ctx.$rootScope.$digest();

        scenario.variables = ctx.variableSrv.variables;
      });

      fn(scenario);
    });
  }

  ['query', 'interval', 'custom', 'datasource'].forEach(type => {
    describeInitScenario('when setting ' + type + ' variable via url', scenario => {
      scenario.setup(() => {
        scenario.variables = [{
          name: 'apps',
          type: type,
          current: {text: "test", value: "test"},
          options: [{text: "test", value: "test"}]
        }];
        scenario.urlParams["var-apps"] = "new";
      });

      it('should update current value', () => {
        expect(scenario.variables[0].current.value).to.be("new");
        expect(scenario.variables[0].current.text).to.be("new");
      });
    });

  });

  describe('given dependent variables', () => {
    var variableList = [
      {
        name: 'app',
        type: 'query',
        query: '',
        current: {text: "app1", value: "app1"},
        options: [{text: "app1", value: "app1"}]
      },
      {
        name: 'server',
        type: 'query',
        refresh: 1,
        query: '$app.*',
        current: {text: "server1", value: "server1"},
        options: [{text: "server1", value: "server1"}]
      },
    ];

    describeInitScenario('when setting parent var from url', scenario => {
      scenario.setup(() => {
        scenario.variables = _.cloneDeep(variableList);
        scenario.urlParams["var-app"] = "google";
        scenario.queryResult = [{text: 'google-server1'}, {text: 'google-server2'}];
      });

      it('should update child variable', () => {
        expect(scenario.variables[1].options.length).to.be(2);
        expect(scenario.variables[1].current.text).to.be("google-server1");
      });

      it('should only update it once', () => {
        expect(ctx.datasource.metricFindQuery.callCount).to.be(1);
      });

    });
  });

});

