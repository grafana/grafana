import '../all';
import { VariableSrv } from '../variable_srv';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import $q from 'q';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';
import { CustomVariable } from '../custom_variable';

describe('VariableSrv', function(this: any) {
  const ctx = {
    datasourceSrv: {},
    timeSrv: {
      timeRange: () => {
        return { from: '2018-01-29', to: '2019-01-29' };
      },
    },
    $rootScope: {
      $on: () => {},
    },
    $injector: {
      instantiate: (ctr, obj) => new ctr(obj.model),
    },
    templateSrv: {
      setGrafanaVariable: jest.fn(),
      init: vars => {
        this.variables = vars;
      },
      updateIndex: () => {},
      replace: str =>
        str.replace(this.regex, match => {
          return match;
        }),
    },
    $location: {
      search: () => {},
    },
  } as any;

  function describeUpdateVariable(desc, fn) {
    describe(desc, () => {
      const scenario: any = {};
      scenario.setup = setupFn => {
        scenario.setupFn = setupFn;
      };

      beforeEach(async () => {
        scenario.setupFn();

        const ds: any = {};
        ds.metricFindQuery = () => Promise.resolve(scenario.queryResult);

        ctx.variableSrv = new VariableSrv($q, ctx.$location, ctx.$injector, ctx.templateSrv, ctx.timeSrv);

        ctx.variableSrv.timeSrv = ctx.timeSrv;
        ctx.datasourceSrv = {
          get: () => Promise.resolve(ds),
          getMetricSources: () => scenario.metricSources,
        };

        ctx.$injector.instantiate = (ctr, model) => {
          return getVarMockConstructor(ctr, model, ctx);
        };

        ctx.variableSrv.init(
          new DashboardModel({
            templating: { list: [] },
            updateSubmenuVisibility: () => {},
          })
        );

        scenario.variable = ctx.variableSrv.createVariableFromModel(scenario.variableModel);
        ctx.variableSrv.addVariable(scenario.variable);

        await ctx.variableSrv.updateOptions(scenario.variable);
      });

      fn(scenario);
    });
  }

  describeUpdateVariable('interval variable without auto', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'interval',
        query: '1s,2h,5h,1d',
        name: 'test',
      };
    });

    it('should update options array', () => {
      expect(scenario.variable.options.length).toBe(4);
      expect(scenario.variable.options[0].text).toBe('1s');
      expect(scenario.variable.options[0].value).toBe('1s');
    });
  });

  //
  // Interval variable update
  //
  describeUpdateVariable('interval variable with auto', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'interval',
        query: '1s,2h,5h,1d',
        name: 'test',
        auto: true,
        auto_count: 10,
      };

      const range = {
        from: dateTime(new Date())
          .subtract(7, 'days')
          .toDate(),
        to: new Date(),
      };

      ctx.timeSrv.timeRange = () => range;
      //   ctx.templateSrv.setGrafanaVariable = jest.fn();
    });

    it('should update options array', () => {
      expect(scenario.variable.options.length).toBe(5);
      expect(scenario.variable.options[0].text).toBe('auto');
      expect(scenario.variable.options[0].value).toBe('$__auto_interval_test');
    });

    it('should set $__auto_interval_test', () => {
      const call = ctx.templateSrv.setGrafanaVariable.mock.calls[0];
      expect(call[0]).toBe('$__auto_interval_test');
      expect(call[1]).toBe('12h');
    });

    // updateAutoValue() gets called twice: once directly once via VariableSrv.validateVariableSelectionState()
    // So use lastCall instead of a specific call number
    it('should set $__auto_interval', () => {
      const call = ctx.templateSrv.setGrafanaVariable.mock.calls.pop();
      expect(call[0]).toBe('$__auto_interval');
      expect(call[1]).toBe('12h');
    });
  });

  //
  // Query variable update
  //
  describeUpdateVariable('query variable with empty current object and refresh', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: '',
        name: 'test',
        current: {},
      };
      scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
    });

    it('should set current value to first option', () => {
      expect(scenario.variable.options.length).toBe(2);
      expect(scenario.variable.current.value).toBe('backend1');
    });
  });

  describeUpdateVariable(
    'query variable with multi select and new options does not contain some selected values',
    scenario => {
      scenario.setup(() => {
        scenario.variableModel = {
          type: 'query',
          query: '',
          name: 'test',
          current: {
            value: ['val1', 'val2', 'val3'],
            text: 'val1 + val2 + val3',
          },
        };
        scenario.queryResult = [{ text: 'val2' }, { text: 'val3' }];
      });

      it('should update current value', () => {
        expect(scenario.variable.current.value).toEqual(['val2', 'val3']);
        expect(scenario.variable.current.text).toEqual('val2 + val3');
      });
    }
  );

  describeUpdateVariable(
    'query variable with multi select and new options does not contain any selected values',
    scenario => {
      scenario.setup(() => {
        scenario.variableModel = {
          type: 'query',
          query: '',
          name: 'test',
          current: {
            value: ['val1', 'val2', 'val3'],
            text: 'val1 + val2 + val3',
          },
        };
        scenario.queryResult = [{ text: 'val5' }, { text: 'val6' }];
      });

      it('should update current value with first one', () => {
        expect(scenario.variable.current.value).toEqual('val5');
        expect(scenario.variable.current.text).toEqual('val5');
      });
    }
  );

  describeUpdateVariable('query variable with multi select and $__all selected', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: '',
        name: 'test',
        includeAll: true,
        current: {
          value: ['$__all'],
          text: 'All',
        },
      };
      scenario.queryResult = [{ text: 'val5' }, { text: 'val6' }];
    });

    it('should keep current All value', () => {
      expect(scenario.variable.current.value).toEqual(['$__all']);
      expect(scenario.variable.current.text).toEqual('All');
    });
  });

  describeUpdateVariable('query variable with numeric results', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: '',
        name: 'test',
        current: {},
      };
      scenario.queryResult = [{ text: 12, value: 12 }];
    });

    it('should set current value to first option', () => {
      expect(scenario.variable.current.value).toBe('12');
      expect(scenario.variable.options[0].value).toBe('12');
      expect(scenario.variable.options[0].text).toBe('12');
    });
  });

  describeUpdateVariable('basic query variable', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
    });

    it('should update options array', () => {
      expect(scenario.variable.options.length).toBe(2);
      expect(scenario.variable.options[0].text).toBe('backend1');
      expect(scenario.variable.options[0].value).toBe('backend1');
      expect(scenario.variable.options[1].value).toBe('backend2');
    });

    it('should select first option as value', () => {
      expect(scenario.variable.current.value).toBe('backend1');
    });
  });

  describeUpdateVariable('and existing value still exists in options', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.variableModel.current = { value: 'backend2', text: 'backend2' };
      scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
    });

    it('should keep variable value', () => {
      expect(scenario.variable.current.text).toBe('backend2');
    });
  });

  describeUpdateVariable('and regex pattern exists', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.variableModel.regex = '/apps.*(backend_[0-9]+)/';
      scenario.queryResult = [
        { text: 'apps.backend.backend_01.counters.req' },
        { text: 'apps.backend.backend_02.counters.req' },
      ];
    });

    it('should extract and use match group', () => {
      expect(scenario.variable.options[0].value).toBe('backend_01');
    });
  });

  describeUpdateVariable('and regex pattern exists and no match', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.variableModel.regex = '/apps.*(backendasd[0-9]+)/';
      scenario.queryResult = [
        { text: 'apps.backend.backend_01.counters.req' },
        { text: 'apps.backend.backend_02.counters.req' },
      ];
    });

    it('should not add non matching items, None option should be added instead', () => {
      expect(scenario.variable.options.length).toBe(1);
      expect(scenario.variable.options[0].isNone).toBe(true);
    });
  });

  describeUpdateVariable('regex pattern without slashes', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.variableModel.regex = 'backend_01';
      scenario.queryResult = [
        { text: 'apps.backend.backend_01.counters.req' },
        { text: 'apps.backend.backend_02.counters.req' },
      ];
    });

    it('should return matches options', () => {
      expect(scenario.variable.options.length).toBe(1);
    });
  });

  describeUpdateVariable('regex pattern remove duplicates', scenario => {
    scenario.setup(() => {
      scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
      scenario.variableModel.regex = '/backend_01/';
      scenario.queryResult = [
        { text: 'apps.backend.backend_01.counters.req' },
        { text: 'apps.backend.backend_01.counters.req' },
      ];
    });

    it('should return matches options', () => {
      expect(scenario.variable.options.length).toBe(1);
    });
  });

  describeUpdateVariable('with include All', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        includeAll: true,
      };
      scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }, { text: 'backend3' }];
    });

    it('should add All option', () => {
      expect(scenario.variable.options[0].text).toBe('All');
      expect(scenario.variable.options[0].value).toBe('$__all');
    });
  });

  describeUpdateVariable('with include all and custom value', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        includeAll: true,
        allValue: '*',
      };
      scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }, { text: 'backend3' }];
    });

    it('should add All option with custom value', () => {
      expect(scenario.variable.options[0].value).toBe('$__all');
    });
  });

  describeUpdateVariable('without sort', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        sort: 0,
      };
      scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
    });

    it('should return options without sort', () => {
      expect(scenario.variable.options[0].text).toBe('bbb2');
      expect(scenario.variable.options[1].text).toBe('aaa10');
      expect(scenario.variable.options[2].text).toBe('ccc3');
    });
  });

  describeUpdateVariable('with alphabetical sort (asc)', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        sort: 1,
      };
      scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
    });

    it('should return options with alphabetical sort', () => {
      expect(scenario.variable.options[0].text).toBe('aaa10');
      expect(scenario.variable.options[1].text).toBe('bbb2');
      expect(scenario.variable.options[2].text).toBe('ccc3');
    });
  });

  describeUpdateVariable('with alphabetical sort (desc)', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        sort: 2,
      };
      scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
    });

    it('should return options with alphabetical sort', () => {
      expect(scenario.variable.options[0].text).toBe('ccc3');
      expect(scenario.variable.options[1].text).toBe('bbb2');
      expect(scenario.variable.options[2].text).toBe('aaa10');
    });
  });

  describeUpdateVariable('with numerical sort (asc)', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        sort: 3,
      };
      scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
    });

    it('should return options with numerical sort', () => {
      expect(scenario.variable.options[0].text).toBe('bbb2');
      expect(scenario.variable.options[1].text).toBe('ccc3');
      expect(scenario.variable.options[2].text).toBe('aaa10');
    });
  });

  describeUpdateVariable('with numerical sort (desc)', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'query',
        query: 'apps.*',
        name: 'test',
        sort: 4,
      };
      scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
    });

    it('should return options with numerical sort', () => {
      expect(scenario.variable.options[0].text).toBe('aaa10');
      expect(scenario.variable.options[1].text).toBe('ccc3');
      expect(scenario.variable.options[2].text).toBe('bbb2');
    });
  });

  //
  // datasource variable update
  //
  describeUpdateVariable('datasource variable with regex filter', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'datasource',
        query: 'graphite',
        name: 'test',
        current: { value: 'backend4_pee', text: 'backend4_pee' },
        regex: '/pee$/',
      };
      scenario.metricSources = [
        { name: 'backend1', meta: { id: 'influx' } },
        { name: 'backend2_pee', meta: { id: 'graphite' } },
        { name: 'backend3', meta: { id: 'graphite' } },
        { name: 'backend4_pee', meta: { id: 'graphite' } },
      ];
    });

    it('should set only contain graphite ds and filtered using regex', () => {
      expect(scenario.variable.options.length).toBe(2);
      expect(scenario.variable.options[0].value).toBe('backend2_pee');
      expect(scenario.variable.options[1].value).toBe('backend4_pee');
    });

    it('should keep current value if available', () => {
      expect(scenario.variable.current.value).toBe('backend4_pee');
    });
  });

  //
  // Custom variable update
  //
  describeUpdateVariable('update custom variable', scenario => {
    scenario.setup(() => {
      scenario.variableModel = {
        type: 'custom',
        query: 'hej, hop, asd, escaped\\,var',
        name: 'test',
      };
    });

    it('should update options array', () => {
      expect(scenario.variable.options.length).toBe(4);
      expect(scenario.variable.options[0].text).toBe('hej');
      expect(scenario.variable.options[1].value).toBe('hop');
      expect(scenario.variable.options[2].value).toBe('asd');
      expect(scenario.variable.options[3].value).toBe('escaped,var');
    });
  });

  describe('multiple interval variables with auto', () => {
    let variable1, variable2;

    beforeEach(() => {
      const range = {
        from: dateTime(new Date())
          .subtract(7, 'days')
          .toDate(),
        to: new Date(),
      };
      ctx.timeSrv.timeRange = () => range;
      ctx.templateSrv.setGrafanaVariable = jest.fn();

      const variableModel1 = {
        type: 'interval',
        query: '1s,2h,5h,1d',
        name: 'variable1',
        auto: true,
        auto_count: 10,
      };
      variable1 = ctx.variableSrv.createVariableFromModel(variableModel1);
      ctx.variableSrv.addVariable(variable1);

      const variableModel2 = {
        type: 'interval',
        query: '1s,2h,5h',
        name: 'variable2',
        auto: true,
        auto_count: 1000,
      };
      variable2 = ctx.variableSrv.createVariableFromModel(variableModel2);
      ctx.variableSrv.addVariable(variable2);

      ctx.variableSrv.updateOptions(variable1);
      ctx.variableSrv.updateOptions(variable2);
      // ctx.$rootScope.$digest();
    });

    it('should update options array', () => {
      expect(variable1.options.length).toBe(5);
      expect(variable1.options[0].text).toBe('auto');
      expect(variable1.options[0].value).toBe('$__auto_interval_variable1');
      expect(variable2.options.length).toBe(4);
      expect(variable2.options[0].text).toBe('auto');
      expect(variable2.options[0].value).toBe('$__auto_interval_variable2');
    });

    it('should correctly set $__auto_interval_variableX', () => {
      let variable1Set,
        variable2Set,
        legacySet,
        unknownSet = false;
      // updateAutoValue() gets called repeatedly: once directly once via VariableSrv.validateVariableSelectionState()
      // So check that all calls are valid rather than expect a specific number and/or ordering of calls
      for (let i = 0; i < ctx.templateSrv.setGrafanaVariable.mock.calls.length; i++) {
        const call = ctx.templateSrv.setGrafanaVariable.mock.calls[i];
        switch (call[0]) {
          case '$__auto_interval_variable1':
            expect(call[1]).toBe('12h');
            variable1Set = true;
            break;
          case '$__auto_interval_variable2':
            expect(call[1]).toBe('10m');
            variable2Set = true;
            break;
          case '$__auto_interval':
            expect(call[1]).toEqual(expect.stringMatching(/^(12h|10m)$/));
            legacySet = true;
            break;
          default:
            unknownSet = true;
            break;
        }
      }
      expect(variable1Set).toEqual(true);
      expect(variable2Set).toEqual(true);
      expect(legacySet).toEqual(true);
      expect(unknownSet).toEqual(false);
    });
  });

  describe('setOptionFromUrl', () => {
    it('sets single value as string if not multi choice', async () => {
      const [setValueMock, setFromUrl] = setupSetFromUrlTest(ctx);
      await setFromUrl('one');
      expect(setValueMock).toHaveBeenCalledWith({ text: 'one', value: 'one' });
    });

    it('sets single value as array if multi choice', async () => {
      const [setValueMock, setFromUrl] = setupSetFromUrlTest(ctx, { multi: true });
      await setFromUrl('one');
      expect(setValueMock).toHaveBeenCalledWith({ text: ['one'], value: ['one'] });
    });

    it('sets both text and value as array if multiple values in url', async () => {
      const [setValueMock, setFromUrl] = setupSetFromUrlTest(ctx, { multi: true });
      await setFromUrl(['one', 'two']);
      expect(setValueMock).toHaveBeenCalledWith({ text: ['one', 'two'], value: ['one', 'two'] });
    });

    it('sets text and value even if it does not match any option', async () => {
      const [setValueMock, setFromUrl] = setupSetFromUrlTest(ctx);
      await setFromUrl('none');
      expect(setValueMock).toHaveBeenCalledWith({ text: 'none', value: 'none' });
    });

    it('sets text and value even if it does not match any option and it is array', async () => {
      const [setValueMock, setFromUrl] = setupSetFromUrlTest(ctx);
      await setFromUrl(['none', 'none2']);
      expect(setValueMock).toHaveBeenCalledWith({ text: ['none', 'none2'], value: ['none', 'none2'] });
    });
  });
});

function setupSetFromUrlTest(ctx, model = {}) {
  const variableSrv = new VariableSrv($q, ctx.$location, ctx.$injector, ctx.templateSrv, ctx.timeSrv);
  const finalModel = {
    type: 'custom',
    options: ['one', 'two', 'three'].map(v => ({ text: v, value: v })),
    name: 'test',
    ...model,
  };
  const variable = new CustomVariable(finalModel, variableSrv);
  // We are mocking the setValue here instead of just checking the final variable.current value because there is lots
  // of stuff going when the setValue is called that is hard to mock out.
  variable.setValue = jest.fn();
  return [variable.setValue, val => variableSrv.setOptionFromUrl(variable, val)];
}

function getVarMockConstructor(variable, model, ctx) {
  switch (model.model.type) {
    case 'datasource':
      return new variable(model.model, ctx.datasourceSrv, ctx.variableSrv, ctx.templateSrv);
    case 'query':
      return new variable(model.model, ctx.datasourceSrv, ctx.templateSrv, ctx.variableSrv);
    case 'interval':
      return new variable(model.model, ctx.timeSrv, ctx.templateSrv, ctx.variableSrv);
    case 'custom':
      return new variable(model.model, ctx.variableSrv);
    default:
      return new variable(model.model);
  }
}
