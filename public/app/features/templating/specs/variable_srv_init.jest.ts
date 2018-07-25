//import { describe, beforeEach, it, sinon, expect, angularMocks } from 'test/lib/common';

import '../all';

import _ from 'lodash';
// import helpers from 'test/specs/helpers';
// import { Emitter } from 'app/core/core';
import { VariableSrv } from '../variable_srv';
import $q from 'q';

describe('VariableSrv init', function() {
  let templateSrv = {
    init: () => {},
  };
  let $injector = {
    instantiate: (vars, model) => {
      return new vars(model.model);
    },
  };
  let $rootscope = {
    $on: () => {},
  };

  let ctx = <any>{
    datasourceSrv: {},
    $location: {},
    dashboard: {},
  };

  //   beforeEach(angularMocks.module('grafana.core'));
  //   beforeEach(angularMocks.module('grafana.controllers'));
  //   beforeEach(angularMocks.module('grafana.services'));
  //   beforeEach(
  //     angularMocks.module(function($compileProvider) {
  //       $compileProvider.preAssignBindingsEnabled(true);
  //     })
  //   );

  //   beforeEach(ctx.providePhase(['datasourceSrv', 'timeSrv', 'templateSrv', '$location']));
  //   beforeEach(
  //     angularMocks.inject(($rootScope, $q, $location, $injector) => {
  //       ctx.$q = $q;
  //       ctx.$rootScope = $rootScope;
  //       ctx.$location = $location;
  //       ctx.variableSrv = $injector.get('variableSrv');
  //       ctx.$rootScope.$digest();
  //     })
  //   );

  function describeInitScenario(desc, fn) {
    describe(desc, function() {
      //   events: new Emitter(),
      var scenario: any = {
        urlParams: {},
        setup: setupFn => {
          scenario.setupFn = setupFn;
        },
      };

      beforeEach(function() {
        scenario.setupFn();
        ctx.variableSrv = new VariableSrv($rootscope, $q, {}, $injector, templateSrv);
        ctx.variableSrv.datasource = {};
        ctx.variableSrv.datasource.metricFindQuery = jest.fn(() => Promise.resolve(scenario.queryResult));

        ctx.variableSrv.datasourceSrv = {
          get: () => Promise.resolve(ctx.datasource),
          getMetricSources: () => Promise.resolve(scenario.metricSources),
        };

        ctx.variableSrv.$location.search = () => Promise.resolve(scenario.urlParams);
        ctx.variableSrv.dashboard = {
          templating: { list: scenario.variables },
          //   events: new Emitter(),
        };

        ctx.variableSrv.init(ctx.variableSrv.dashboard);
        // ctx.$rootScope.$digest();

        scenario.variables = ctx.variableSrv.variables;
      });

      fn(scenario);
    });
  }

  ['query', 'interval', 'custom', 'datasource'].forEach(type => {
    describeInitScenario('when setting ' + type + ' variable via url', scenario => {
      scenario.setup(() => {
        scenario.variables = [
          {
            name: 'apps',
            type: type,
            current: { text: 'test', value: 'test' },
            options: [{ text: 'test', value: 'test' }],
          },
        ];
        scenario.urlParams['var-apps'] = 'new';
        scenario.metricSources = [];
      });

      it('should update current value', () => {
        expect(scenario.variables[0].current.value).toBe('new');
        expect(scenario.variables[0].current.text).toBe('new');
      });
    });
  });

  describe('given dependent variables', () => {
    var variableList = [
      {
        name: 'app',
        type: 'query',
        query: '',
        current: { text: 'app1', value: 'app1' },
        options: [{ text: 'app1', value: 'app1' }],
      },
      {
        name: 'server',
        type: 'query',
        refresh: 1,
        query: '$app.*',
        current: { text: 'server1', value: 'server1' },
        options: [{ text: 'server1', value: 'server1' }],
      },
    ];

    describeInitScenario('when setting parent var from url', scenario => {
      scenario.setup(() => {
        scenario.variables = _.cloneDeep(variableList);
        scenario.urlParams['var-app'] = 'google';
        scenario.queryResult = [{ text: 'google-server1' }, { text: 'google-server2' }];
      });

      it('should update child variable', () => {
        expect(scenario.variables[1].options.length).toBe(2);
        expect(scenario.variables[1].current.text).toBe('google-server1');
      });

      it('should only update it once', () => {
        expect(ctx.variableSrv.datasource.metricFindQuery).toHaveBeenCalledTimes(1);
      });
    });
  });

  describeInitScenario('when datasource variable is initialized', scenario => {
    scenario.setup(() => {
      scenario.variables = [
        {
          type: 'datasource',
          query: 'graphite',
          name: 'test',
          current: { value: 'backend4_pee', text: 'backend4_pee' },
          regex: '/pee$/',
        },
      ];
      scenario.metricSources = [
        { name: 'backend1', meta: { id: 'influx' } },
        { name: 'backend2_pee', meta: { id: 'graphite' } },
        { name: 'backend3', meta: { id: 'graphite' } },
        { name: 'backend4_pee', meta: { id: 'graphite' } },
      ];
    });

    it('should update current value', function() {
      var variable = ctx.variableSrv.variables[0];
      expect(variable.options.length).toBe(2);
    });
  });

  describeInitScenario('when template variable is present in url multiple times', scenario => {
    scenario.setup(() => {
      scenario.variables = [
        {
          name: 'apps',
          type: 'query',
          multi: true,
          current: { text: 'val1', value: 'val1' },
          options: [
            { text: 'val1', value: 'val1' },
            { text: 'val2', value: 'val2' },
            { text: 'val3', value: 'val3', selected: true },
          ],
        },
      ];
      scenario.urlParams['var-apps'] = ['val2', 'val1'];
    });

    it('should update current value', function() {
      var variable = ctx.variableSrv.variables[0];
      expect(variable.current.value.length).toBe(2);
      expect(variable.current.value[0]).toBe('val2');
      expect(variable.current.value[1]).toBe('val1');
      expect(variable.current.text).toBe('val2 + val1');
      expect(variable.options[0].selected).toBe(true);
      expect(variable.options[1].selected).toBe(true);
    });

    it('should set options that are not in value to selected false', function() {
      var variable = ctx.variableSrv.variables[0];
      expect(variable.options[2].selected).toBe(false);
    });
  });

  describeInitScenario('when template variable is present in url multiple times using key/values', scenario => {
    scenario.setup(() => {
      scenario.variables = [
        {
          name: 'apps',
          type: 'query',
          multi: true,
          current: { text: 'Val1', value: 'val1' },
          options: [
            { text: 'Val1', value: 'val1' },
            { text: 'Val2', value: 'val2' },
            { text: 'Val3', value: 'val3', selected: true },
          ],
        },
      ];
      scenario.urlParams['var-apps'] = ['val2', 'val1'];
    });

    it('should update current value', function() {
      var variable = ctx.variableSrv.variables[0];
      expect(variable.current.value.length).toBe(2);
      expect(variable.current.value[0]).toBe('val2');
      expect(variable.current.value[1]).toBe('val1');
      expect(variable.current.text).toBe('Val2 + Val1');
      expect(variable.options[0].selected).toBe(true);
      expect(variable.options[1].selected).toBe(true);
    });

    it('should set options that are not in value to selected false', function() {
      var variable = ctx.variableSrv.variables[0];
      expect(variable.options[2].selected).toBe(false);
    });
  });
});
