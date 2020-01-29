import '../all';

import _ from 'lodash';
import { VariableSrv } from '../variable_srv';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
// @ts-ignore
import $q from 'q';

jest.mock('app/core/core', () => ({
  contextSrv: {
    user: { orgId: 1, orgName: 'TestOrg' },
  },
}));

describe('VariableSrv init', function(this: any) {
  const templateSrv = {
    init: (vars: any) => {
      this.variables = vars;
    },
    variableInitialized: () => {},
    updateIndex: () => {},
    setGlobalVariable: (name: string, variable: any) => {},
    replace: (str: string) =>
      str.replace(this.regex, match => {
        return match;
      }),
  };

  const timeSrv = {
    timeRange: () => {
      return { from: '2018-01-29', to: '2019-01-29' };
    },
  };

  const $injector = {} as any;
  let ctx = {} as any;

  function describeInitScenario(desc: string, fn: Function) {
    describe(desc, () => {
      const scenario: any = {
        urlParams: {},
        setup: (setupFn: Function) => {
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

        // @ts-ignore
        ctx.variableSrv = new VariableSrv($q, {}, $injector, templateSrv, timeSrv);

        $injector.instantiate = (variable: any, model: any) => {
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
    describeInitScenario('when setting ' + type + ' variable via url', (scenario: any) => {
      scenario.setup(() => {
        scenario.variables = [
          {
            name: 'apps',
            type: type,
            current: { text: 'Test', value: 'test' },
            options: [{ text: 'Test', value: 'test' }],
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

    describeInitScenario('when setting parent const from url', (scenario: any) => {
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

  describeInitScenario('when datasource variable is initialized', (scenario: any) => {
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

  describeInitScenario('when template variable is present in url multiple times', (scenario: any) => {
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

  describeInitScenario(
    'when template variable is present in url multiple times and variables have no text',
    (scenario: any) => {
      scenario.setup(() => {
        scenario.variables = [
          {
            name: 'apps',
            type: 'query',
            multi: true,
          },
        ];
        scenario.urlParams['var-apps'] = ['val1', 'val2'];
      });

      it('should display concatenated values in text', () => {
        const variable = ctx.variableSrv.variables[0];
        expect(variable.current.value.length).toBe(2);
        expect(variable.current.value[0]).toBe('val1');
        expect(variable.current.value[1]).toBe('val2');
        expect(variable.current.text).toBe('val1 + val2');
      });
    }
  );

  describeInitScenario('when template variable is present in url multiple times using key/values', (scenario: any) => {
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

function getVarMockConstructor(variable: any, model: any, ctx: any) {
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
