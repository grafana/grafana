import '../all';

import _ from 'lodash';
import { VariableSrv } from '../variable_srv';
import { DashboardModel } from '../../dashboard/dashboard_model';
import $q from 'q';

describe('VariableSrv init', function(this: any) {
  const templateSrv = {
    init: vars => {
      this.variables = vars;
    },
    variableInitialized: () => {},
    updateTemplateData: () => {},
    replace: str =>
      str.replace(this.regex, match => {
        return match;
      }),
  };

  const $injector = {} as any;
  const $rootscope = {
    $on: () => {},
  };

  let ctx = {} as any;

  function describeInitScenario(desc, fn) {
    describe(desc, () => {
      const scenario: any = {
        urlParams: {},
        setup: setupFn => {
          scenario.setupFn = setupFn;
        },
      };

      beforeEach(async () => {
        scenario.setupFn();
        ctx = {
          datasource: {
            metricFindQuery: jest.fn(() => Promise.resolve(scenario.queryResult)),
          },
          datasourceSrv: {
            get: () => Promise.resolve(ctx.datasource),
            getMetricSources: () => scenario.metricSources,
          },
          templateSrv,
        };

        ctx.variableSrv = new VariableSrv($rootscope, $q, {}, $injector, templateSrv);

        $injector.instantiate = (variable, model) => {
          return getVarMockConstructor(variable, model, ctx);
        };

        ctx.variableSrv.datasource = ctx.datasource;
        ctx.variableSrv.datasourceSrv = ctx.datasourceSrv;

        ctx.variableSrv.$location.search = () => scenario.urlParams;
        ctx.variableSrv.dashboard = new DashboardModel({
          templating: { list: scenario.variables },
        });

        await ctx.variableSrv.init(ctx.variableSrv.dashboard);

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
    const variableList = [
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

    describeInitScenario('when setting parent const from url', scenario => {
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

    it('should update current value', () => {
      const variable = ctx.variableSrv.variables[0];
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

    it('should update current value', () => {
      const variable = ctx.variableSrv.variables[0];
      expect(variable.current.value.length).toBe(2);
      expect(variable.current.value[0]).toBe('val2');
      expect(variable.current.value[1]).toBe('val1');
      expect(variable.current.text).toBe('val2 + val1');
      expect(variable.options[0].selected).toBe(true);
      expect(variable.options[1].selected).toBe(true);
    });

    it('should set options that are not in value to selected false', () => {
      const variable = ctx.variableSrv.variables[0];
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

    it('should update current value', () => {
      const variable = ctx.variableSrv.variables[0];
      expect(variable.current.value.length).toBe(2);
      expect(variable.current.value[0]).toBe('val2');
      expect(variable.current.value[1]).toBe('val1');
      expect(variable.current.text).toBe('Val2 + Val1');
      expect(variable.options[0].selected).toBe(true);
      expect(variable.options[1].selected).toBe(true);
    });

    it('should set options that are not in value to selected false', () => {
      const variable = ctx.variableSrv.variables[0];
      expect(variable.options[2].selected).toBe(false);
    });
  });
});

function getVarMockConstructor(variable, model, ctx) {
  switch (model.model.type) {
    case 'datasource':
      return new variable(model.model, ctx.datasourceSrv, ctx.variableSrv, ctx.templateSrv);
    case 'query':
      return new variable(model.model, ctx.datasourceSrv, ctx.templateSrv, ctx.variableSrv);
    case 'interval':
      return new variable(model.model, {}, ctx.templateSrv, ctx.variableSrv);
    case 'custom':
      return new variable(model.model, ctx.variableSrv);
    default:
      return new variable(model.model);
  }
}
