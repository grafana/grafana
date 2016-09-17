import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import moment from 'moment';
import helpers from 'test/specs/helpers';
import '../all';

describe('VariableSrv Init', function() {
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

  function describeInitSceneario(desc, fn) {
    describe(desc, function() {
      var scenario: any = {
        urlParams: {},
        setup: setupFn => {
          scenario.setupFn = setupFn;
        }
      };

      beforeEach(function() {
        scenario.setupFn();
        var ds: any = {};
        ds.metricFindQuery = sinon.stub().returns(ctx.$q.when(scenario.queryResult));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));
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

  describeInitSceneario('when setting query variable via url', scenario => {
    scenario.setup(() => {
      scenario.variables = [{
        name: 'apps',
        type: 'query',
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

  describeInitSceneario('when setting custom variable via url', scenario => {
    scenario.setup(() => {
      scenario.variables = [{
        name: 'apps',
        type: 'custom',
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

