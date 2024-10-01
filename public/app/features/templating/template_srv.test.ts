import { dateTime, QueryVariableModel, TimeRange, TypedVariableModel } from '@grafana/data';
import { setDataSourceSrv, VariableInterpolation } from '@grafana/runtime';
import {
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  EmbeddedScene,
  IntervalVariable,
  QueryVariable,
  SafeSerializableSceneObject,
  SceneCanvasText,
  SceneVariableSet,
  TestVariable,
} from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

import { silenceConsoleOutput } from '../../../test/core/utils/silenceConsoleOutput';
import { initTemplateSrv } from '../../../test/helpers/initTemplateSrv';
import { mockDataSource, MockDataSourceSrv } from '../alerting/unified/mocks';
import { VariableAdapter, variableAdapters } from '../variables/adapters';
import { createAdHocVariableAdapter } from '../variables/adhoc/adapter';
import { createQueryVariableAdapter } from '../variables/query/adapter';

import { TemplateSrv } from './template_srv';

const key = 'key';

variableAdapters.setInit(() => [
  createQueryVariableAdapter() as unknown as VariableAdapter<TypedVariableModel>,
  createAdHocVariableAdapter() as unknown as VariableAdapter<TypedVariableModel>,
]);

const interpolateMock = jest.fn();
const timeRangeMock = jest.fn().mockReturnValue({
  state: { value: { from: dateTime(1594671549254), to: dateTime(1594671549254), raw: { from: '12', to: '14' } } },
});

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    ...jest.requireActual('@grafana/scenes').sceneGraph,
    interpolate: (...args: unknown[]) => interpolateMock(...args),
    getTimeRange: (...args: unknown[]) => timeRangeMock(...args),
  },
}));

describe('templateSrv', () => {
  silenceConsoleOutput();
  let _templateSrv: TemplateSrv;

  describe('init', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should initialize template data', () => {
      const target = _templateSrv.replace('this.[[test]].filters');
      expect(target).toBe('this.oogle.filters');
    });
  });

  describe('replace can pass scoped vars', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('scoped vars should support objects', () => {
      const target = _templateSrv.replace('${series.name} ${series.nested.field}', {
        series: { value: { name: 'Server1', nested: { field: 'nested' } }, text: 'foo' },
      });
      expect(target).toBe('Server1 nested');
    });

    it('built in vars should support objects', () => {
      _templateSrv.setGlobalVariable('__dashboard', {
        value: { name: 'hello' },
      });
      const target = _templateSrv.replace('${__dashboard.name}');
      expect(target).toBe('hello');
    });

    it('scoped vars should support objects with propert names with dot', () => {
      const target = _templateSrv.replace('${series.name} ${series.nested["field.with.dot"]}', {
        series: { value: { name: 'Server1', nested: { 'field.with.dot': 'nested' } }, text: 'foo' },
      });
      expect(target).toBe('Server1 nested');
    });

    it('scoped vars should support arrays of objects', () => {
      const target = _templateSrv.replace('${series.rows[0].name} ${series.rows[1].name}', {
        series: { value: { rows: [{ name: 'first' }, { name: 'second' }] }, text: 'foo' },
      });
      expect(target).toBe('first second');
    });

    it('should replace $test with scoped value', () => {
      const target = _templateSrv.replace('this.$test.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.mupp.filters');
    });

    it('should replace ${test} with scoped value', () => {
      const target = _templateSrv.replace('this.${test}.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.mupp.filters');
    });

    it('should replace ${test:glob} with scoped value', () => {
      const target = _templateSrv.replace('this.${test:glob}.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.mupp.filters');
    });

    it('should replace $test with scoped text', () => {
      const target = _templateSrv.replaceWithText('this.$test.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.asd.filters');
    });

    it('should replace ${test} with scoped text', () => {
      const target = _templateSrv.replaceWithText('this.${test}.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.asd.filters');
    });

    it('should replace ${test.name} with scoped text', () => {
      const target = _templateSrv.replaceWithText('this.${test.name}.filters', {
        test: { value: { name: 'mupp' }, text: 'asd' },
      });
      expect(target).toBe('this.mupp.filters');
    });

    it('should not replace ${test:glob} with scoped text', () => {
      const target = _templateSrv.replaceWithText('this.${test:glob}.filters', {
        test: { value: 'mupp', text: 'asd' },
      });
      expect(target).toBe('this.mupp.filters');
    });
  });

  describe('replace with interpolations map', function () {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'testValue' } }]);
    });

    it('replace can save interpolation result', () => {
      let interpolations: VariableInterpolation[] = [];

      const target = _templateSrv.replace(
        'test.${test}.${scoped}.${nested.name}.${test}.${optionTest:raw}.$notfound',
        {
          scoped: { value: 'scopedValue', text: 'scopedText' },
          optionTest: { value: 'optionTestValue', text: 'optionTestText' },
          nested: { value: { name: 'nestedValue' } },
        },
        undefined,
        interpolations
      );

      expect(target).toBe('test.testValue.scopedValue.nestedValue.testValue.optionTestValue.$notfound');
      expect(interpolations.length).toBe(6);
      expect(interpolations).toEqual([
        {
          match: '${test}',
          found: true,
          value: 'testValue',
          variableName: 'test',
        },
        {
          match: '${scoped}',
          found: true,
          value: 'scopedValue',
          variableName: 'scoped',
        },
        {
          fieldPath: 'name',
          match: '${nested.name}',
          found: true,
          value: 'nestedValue',
          variableName: 'nested',
        },
        {
          match: '${test}',
          found: true,
          value: 'testValue',
          variableName: 'test',
        },
        {
          format: 'raw',
          match: '${optionTest:raw}',
          found: true,
          value: 'optionTestValue',
          variableName: 'optionTest',
        },
        {
          match: '$notfound',
          found: false,
          value: '$notfound',
          variableName: 'notfound',
        },
      ]);
    });
  });

  describe('getAdhocFilters', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'datasource',
          name: 'ds',
          current: { value: 'logstash-id', text: 'logstash' },
        },
        { type: 'adhoc', name: 'test', datasource: { uid: 'oogle' }, filters: [1] },
        { type: 'adhoc', name: 'test2', datasource: { uid: '$ds' }, filters: [2] },
      ]);
      setDataSourceSrv(
        new MockDataSourceSrv({
          oogle: mockDataSource({
            name: 'oogle',
            uid: 'oogle',
          }),
          logstash: mockDataSource({
            name: 'logstash',
            uid: 'logstash-id',
          }),
        })
      );
    });

    it('should return filters if datasourceName match', () => {
      const filters = _templateSrv.getAdhocFilters('oogle');
      expect(filters).toMatchObject([1]);
    });

    it('should return empty array if datasourceName does not match', () => {
      const filters = _templateSrv.getAdhocFilters('oogleasdasd');
      expect(filters).toMatchObject([]);
    });

    it('should return filters when datasourceName match via data source variable', () => {
      const filters = _templateSrv.getAdhocFilters('logstash');
      expect(filters).toMatchObject([2]);
    });
  });

  describe('replace can pass multi / all format', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'test',
          current: { value: ['value1', 'value2'] },
        },
      ]);
    });

    it('should replace $test with globbed value', () => {
      const target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).toBe('this.{value1,value2}.filters');
    });

    describe('when the globbed variable only has one value', () => {
      beforeEach(() => {
        _templateSrv = initTemplateSrv(key, [
          {
            type: 'query',
            name: 'test',
            current: { value: ['value1'] },
          },
        ]);
      });

      it('should not glob the value', () => {
        const target = _templateSrv.replace('this.$test.filters', {}, 'glob');
        expect(target).toBe('this.value1.filters');
      });
    });

    it('should replace ${test} with globbed value', () => {
      const target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
      expect(target).toBe('this.{value1,value2}.filters');
    });

    it('should replace ${test:glob} with globbed value', () => {
      const target = _templateSrv.replace('this.${test:glob}.filters', {});
      expect(target).toBe('this.{value1,value2}.filters');
    });

    it('should replace $test with piped value', () => {
      const target = _templateSrv.replace('this=$test', {}, 'pipe');
      expect(target).toBe('this=value1|value2');
    });

    it('should replace ${test} with piped value', () => {
      const target = _templateSrv.replace('this=${test}', {}, 'pipe');
      expect(target).toBe('this=value1|value2');
    });

    it('should replace ${test:pipe} with piped value', () => {
      const target = _templateSrv.replace('this=${test:pipe}', {});
      expect(target).toBe('this=value1|value2');
    });

    it('should replace ${test:pipe} with piped value and $test with globbed value', () => {
      const target = _templateSrv.replace('${test:pipe},$test', {}, 'glob');
      expect(target).toBe('value1|value2,{value1,value2}');
    });
  });

  describe('variable with all option', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'test',
          current: { value: '$__all' },
          options: [{ value: '$__all' }, { value: 'value1' }, { value: 'value2' }],
        },
      ]);
    });

    it('should replace $test with formatted all value', () => {
      const target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).toBe('this.{value1,value2}.filters');
    });

    it('should replace ${test} with formatted all value', () => {
      const target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
      expect(target).toBe('this.{value1,value2}.filters');
    });

    it('should replace ${test:glob} with formatted all value', () => {
      const target = _templateSrv.replace('this.${test:glob}.filters', {});
      expect(target).toBe('this.{value1,value2}.filters');
    });

    it('should replace ${test:pipe} with piped value and $test with globbed value', () => {
      const target = _templateSrv.replace('${test:pipe},$test', {}, 'glob');
      expect(target).toBe('value1|value2,{value1,value2}');
    });

    it('should replace ${test:queryparam} with correct query parameter', () => {
      const target = _templateSrv.replace('${test:queryparam}', {});
      expect(target).toBe('var-test=All');
    });
  });

  describe('variable with all option and custom value', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'test',
          current: { value: '$__all' },
          allValue: '*',
          options: [{ value: 'value1' }, { value: 'value2' }],
        },
      ]);
    });

    it('should replace $test with formatted all value', () => {
      const target = _templateSrv.replace('this.$test.filters', {}, 'glob');
      expect(target).toBe('this.*.filters');
    });

    it('should replace ${test} with formatted all value', () => {
      const target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
      expect(target).toBe('this.*.filters');
    });

    it('should replace ${test:glob} with formatted all value', () => {
      const target = _templateSrv.replace('this.${test:glob}.filters', {});
      expect(target).toBe('this.*.filters');
    });

    it('should replace ${test:text} with "all" value', () => {
      const target = _templateSrv.replace('this.${test:text}.filters', {});
      expect(target).toBe('this.All.filters');
    });

    it('should not escape custom all value', () => {
      const target = _templateSrv.replace('this.$test', {}, 'regex');
      expect(target).toBe('this.*');
    });

    it('should replace ${test:queryparam} with correct query parameter', () => {
      const target = _templateSrv.replace('${test:queryparam}', {});
      expect(target).toBe('var-test=All');
    });

    describe('percentencode option', () => {
      beforeEach(() => {
        _templateSrv = initTemplateSrv(key, [
          {
            type: 'query',
            name: 'test',
            current: { value: '$__all' },
            allValue: '.+',
            options: [{ value: 'value1' }, { value: 'value2' }],
          },
        ]);
      });

      it('should respect percentencode format', () => {
        const target = _templateSrv.replace('this.${test:percentencode}', {}, 'regex');
        expect(target).toBe('this..%2B');
      });
    });
  });

  describe('lucene format', () => {
    it('should properly escape $test with lucene escape sequences', () => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:$test', {}, 'lucene');
      expect(target).toBe('this:value\\/4');
    });

    it('should properly escape ${test} with lucene escape sequences', () => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:${test}', {}, 'lucene');
      expect(target).toBe('this:value\\/4');
    });

    it('should properly escape ${test:lucene} with lucene escape sequences', () => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:${test:lucene}', {});
      expect(target).toBe('this:value\\/4');
    });
  });

  describe('html format', () => {
    it('should encode values html escape sequences', () => {
      _templateSrv = initTemplateSrv(key, [
        { type: 'query', name: 'test', current: { value: '<script>alert(asd)</script>' } },
      ]);
      const target = _templateSrv.replace('$test', {}, 'html');
      expect(target).toBe('&lt;script&gt;alert(asd)&lt;/script&gt;');
    });
  });

  describe('can check if variable exists', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should return true if $test exists', () => {
      const result = _templateSrv.containsTemplate('$test');
      expect(result).toBe(true);
    });

    it('should return true if $test exists in string', () => {
      const result = _templateSrv.containsTemplate('something $test something');
      expect(result).toBe(true);
    });

    it('should return true if [[test]] exists in string', () => {
      const result = _templateSrv.containsTemplate('something [[test]] something');
      expect(result).toBe(true);
    });

    it('should return true if [[test:csv]] exists in string', () => {
      const result = _templateSrv.containsTemplate('something [[test:csv]] something');
      expect(result).toBe(true);
    });

    it('should return true if ${test} exists in string', () => {
      const result = _templateSrv.containsTemplate('something ${test} something');
      expect(result).toBe(true);
    });

    it('should return true if ${test:raw} exists in string', () => {
      const result = _templateSrv.containsTemplate('something ${test:raw} something');
      expect(result).toBe(true);
    });

    it('should return null if there are no variables in string', () => {
      const result = _templateSrv.containsTemplate('string without variables');
      expect(result).toBe(false);
    });
  });

  describe('can highlight variables in string', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should insert html', () => {
      const result = _templateSrv.highlightVariablesAsHtml('$test');
      expect(result).toBe('<span class="template-variable">$test</span>');
    });

    it('should insert html anywhere in string', () => {
      const result = _templateSrv.highlightVariablesAsHtml('this $test ok');
      expect(result).toBe('this <span class="template-variable">$test</span> ok');
    });

    it('should ignore if variables does not exist', () => {
      const result = _templateSrv.highlightVariablesAsHtml('this $google ok');
      expect(result).toBe('this $google ok');
    });
  });

  describe('updateIndex with simple value', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: 'muuuu' } }]);
    });

    it('should set current value and update template data', () => {
      const target = _templateSrv.replace('this.[[test]].filters');
      expect(target).toBe('this.muuuu.filters');
    });
  });

  describe('replaceWithText', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'server',
          current: { value: '{asd,asd2}', text: 'All' },
        },
        {
          type: 'interval',
          name: 'period',
          current: { value: '$__auto_interval_interval', text: 'auto' },
        },
        {
          type: 'textbox',
          name: 'empty_on_init',
          current: { value: '', text: '' },
        },
        {
          type: 'custom',
          name: 'foo',
          current: { value: 'constructor', text: 'constructor' },
        },
      ]);
      _templateSrv.setGrafanaVariable('$__auto_interval_interval', '13m');
      _templateSrv.updateIndex();
    });

    it('should replace with text except for grafanaVariables', () => {
      const target = _templateSrv.replaceWithText('Server: $server, period: $period');
      expect(target).toBe('Server: All, period: 13m');
    });

    it('should replace empty string-values with an empty string', () => {
      const target = _templateSrv.replaceWithText('Hello $empty_on_init');
      expect(target).toBe('Hello ');
    });

    it('should not return a string representation of a constructor property', () => {
      const target = _templateSrv.replaceWithText('$foo');
      expect(target).not.toBe('function Object() { [native code] }');
      expect(target).toBe('constructor');
    });
  });

  describe('replaceWithText can pass all / multi value', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'server',
          current: { value: ['server1', 'server2'], text: ['Server 1', 'Server 2'] },
        },
        {
          type: 'textbox',
          name: 'empty_on_init',
          current: { value: '', text: '' },
        },
        {
          type: 'query',
          name: 'databases',
          current: { value: '$__all', text: '' },
          options: [{ value: '$__all' }, { value: 'db1', text: 'Database 1' }, { value: 'db2', text: 'Database 2' }],
        },
        {
          type: 'custom',
          name: 'custom_all_value',
          allValue: 'CUSTOM_ALL',
          current: { value: '$__all', text: '' },
          options: [{ value: '$__all' }, { value: 'A-Value', text: 'This A' }, { value: 'B-Value', text: 'This B' }],
        },
      ]);
      _templateSrv.updateIndex();
    });

    it('should replace with text with variable label', () => {
      const target = _templateSrv.replaceWithText('Server: $server');
      expect(target).toBe('Server: Server 1 + Server 2');
    });

    it('should replace empty string-values with an empty string', () => {
      const target = _templateSrv.replaceWithText('Hello $empty_on_init');
      expect(target).toBe('Hello ');
    });

    it('should replace $__all with All', () => {
      const target = _templateSrv.replaceWithText('Db: $databases');
      expect(target).toBe('Db: All');
    });

    it('should replace $__all with All for values with custom all', () => {
      const target = _templateSrv.replaceWithText('Custom: $custom_all_value');
      expect(target).toBe('Custom: All');
    });
  });

  describe('built in interval variables', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, []);
    });

    it('should replace $__interval_ms with interval milliseconds', () => {
      const target = _templateSrv.replace('10 * $__interval_ms', {
        __interval_ms: { text: '100', value: '100' },
      });
      expect(target).toBe('10 * 100');
    });
  });

  describe('date formating', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [], {
        from: dateTime(1594671549254),
        to: dateTime(1595237229747),
      } as TimeRange);
    });

    it('should replace ${__from} with ms epoch value', () => {
      const target = _templateSrv.replace('${__from}');
      expect(target).toBe('1594671549254');
    });

    it('should replace ${__from:date:seconds} with epoch in seconds', () => {
      const target = _templateSrv.replace('${__from:date:seconds}');
      expect(target).toBe('1594671549');
    });

    it('should replace ${__from:date} with iso date', () => {
      const target = _templateSrv.replace('${__from:date}');
      expect(target).toBe('2020-07-13T20:19:09.254Z');
    });

    it('should replace ${__from:date:iso} with iso date', () => {
      const target = _templateSrv.replace('${__from:date:iso}');
      expect(target).toBe('2020-07-13T20:19:09.254Z');
    });

    it('should replace ${__from:date:YYYY-MM} using custom format', () => {
      const target = _templateSrv.replace('${__from:date:YYYY-MM}');
      expect(target).toBe('2020-07');
    });
  });

  describe('handle objects gracefully', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value: { test: 'A' } } }]);
    });

    it('should not pass object to custom function', () => {
      let passedValue: string | null = null;
      _templateSrv.replace('this.${test}.filters', {}, (value: string) => {
        passedValue = value;
        return '';
      });

      expect(passedValue).toBe('[object Object]');
    });
  });

  describe('handle objects gracefully and call toString if defined', () => {
    beforeEach(() => {
      const value = { test: 'A', toString: () => 'hello' };
      _templateSrv = initTemplateSrv(key, [{ type: 'query', name: 'test', current: { value } }]);
    });

    it('should not pass object to custom function', () => {
      let passedValue: string | null = null;
      _templateSrv.replace('this.${test}.filters', {}, (value: string) => {
        passedValue = value;
        return '';
      });

      expect(passedValue).toBe('hello');
    });
  });

  describe('adhoc variables', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'adhoc',
          name: 'adhoc',
          filters: [
            {
              condition: '',
              key: 'alertstate',
              operator: '=',
              value: 'firing',
            },
            {
              condition: '',
              key: 'alertname',
              operator: '=',
              value: 'ExampleAlertAlwaysFiring',
            },
          ],
        },
      ]);
    });

    it(`should not be handled by any registry items except for queryparam`, () => {
      const registryItems = Object.values(VariableFormatID);
      for (const registryItem of registryItems) {
        if (registryItem === VariableFormatID.QueryParam) {
          continue;
        }

        const firstTarget = _templateSrv.replace(`\${adhoc:${registryItem}}`, {});
        expect(firstTarget).toBe('');

        const secondTarget = _templateSrv.replace('${adhoc}', {}, registryItem);
        expect(secondTarget).toBe('');
      }
    });
  });

  describe('queryparam', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, [
        {
          type: 'query',
          name: 'single',
          current: { value: 'value1' },
          options: [{ value: 'value1' }, { value: 'value2' }],
        },
        {
          type: 'query',
          name: 'multi',
          current: { value: ['value1', 'value2'] },
          options: [{ value: 'value1' }, { value: 'value2' }],
        },
        {
          type: 'adhoc',
          name: 'adhoc',
          filters: [
            {
              condition: '',
              key: 'alertstate',
              operator: '=',
              value: 'firing',
            },
            {
              condition: '',
              key: 'alertname',
              operator: '=',
              value: 'ExampleAlertAlwaysFiring',
            },
          ],
        },
      ]);
    });

    it('query variable with single value with queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${single:queryparam}`, {});
      expect(target).toBe('var-single=value1');
    });

    it('query variable with single value with queryparam format and scoped vars should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${single:queryparam}`, { single: { value: 'value1', text: 'value1' } });
      expect(target).toBe('var-single=value1');
    });

    it('query variable with single value and queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace('${single}', {}, 'queryparam');
      expect(target).toBe('var-single=value1');
    });

    it('query variable with single value and queryparam format and scoped vars should return correct queryparam', () => {
      const target = _templateSrv.replace('${single}', { single: { value: 'value1', text: 'value1' } }, 'queryparam');
      expect(target).toBe('var-single=value1');
    });

    it('query variable with multi value with queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${multi:queryparam}`, {});
      expect(target).toBe('var-multi=value1&var-multi=value2');
    });

    it('query variable with multi value with queryparam format and scoped vars should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${multi:queryparam}`, { multi: { value: 'value2', text: 'value2' } });
      expect(target).toBe('var-multi=value2');
    });

    it('query variable with multi value and queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace('${multi}', {}, 'queryparam');
      expect(target).toBe('var-multi=value1&var-multi=value2');
    });

    it('query variable with multi value and queryparam format and scoped vars should return correct queryparam', () => {
      const target = _templateSrv.replace('${multi}', { multi: { value: 'value2', text: 'value2' } }, 'queryparam');
      expect(target).toBe('var-multi=value2');
    });

    it('query variable with adhoc value with queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${adhoc:queryparam}`, {});
      expect(target).toBe('var-adhoc=alertstate%7C%3D%7Cfiring&var-adhoc=alertname%7C%3D%7CExampleAlertAlwaysFiring');
    });

    it('query variable with adhoc value with queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace(`\${adhoc:queryparam}`, { adhoc: { value: 'value2', text: 'value2' } });
      expect(target).toBe('var-adhoc=value2');
    });

    it('query variable with adhoc value and queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace('${adhoc}', {}, 'queryparam');
      expect(target).toBe('var-adhoc=alertstate%7C%3D%7Cfiring&var-adhoc=alertname%7C%3D%7CExampleAlertAlwaysFiring');
    });

    it('query variable with adhoc value and queryparam format should return correct queryparam', () => {
      const target = _templateSrv.replace('${adhoc}', { adhoc: { value: 'value2', text: 'value2' } }, 'queryparam');
      expect(target).toBe('var-adhoc=value2');
    });
  });

  describe('scenes compatibility', () => {
    beforeEach(() => {
      _templateSrv = initTemplateSrv(key, []);
      interpolateMock.mockClear();
    });

    it('should use scene interpolator when scoped var provided', () => {
      const variable = new TestVariable({});

      _templateSrv.replace('test ${test}', { __sceneObject: { value: variable, text: 'foo' } });

      expect(interpolateMock).toHaveBeenCalledTimes(1);
      expect(interpolateMock.mock.calls[0][0]).toEqual(variable);
      expect(interpolateMock.mock.calls[0][1]).toEqual('test ${test}');
    });

    it('should use scene interpolator when scoped var provided via SafeSerializableSceneObject', () => {
      const variable = new TestVariable({});
      const serializable = new SafeSerializableSceneObject(variable);
      _templateSrv.replace('test ${test}', { __sceneObject: serializable });

      expect(interpolateMock).toHaveBeenCalledTimes(1);
      expect(interpolateMock.mock.calls[0][0]).toEqual(variable);
      expect(interpolateMock.mock.calls[0][1]).toEqual('test ${test}');
    });

    it('should use scene interpolator global __grafanaSceneContext is active', () => {
      window.__grafanaSceneContext = new EmbeddedScene({
        $variables: new SceneVariableSet({
          variables: [new ConstantVariable({ name: 'sceneVar', value: 'hello' })],
        }),
        body: new SceneCanvasText({ text: 'hello' }),
      });

      window.__grafanaSceneContext.activate();

      _templateSrv.replace('test ${sceneVar}');
      expect(interpolateMock).toHaveBeenCalledTimes(1);
      expect(interpolateMock.mock.calls[0][0]).toEqual(window.__grafanaSceneContext);
      expect(interpolateMock.mock.calls[0][1]).toEqual('test ${sceneVar}');
    });

    it('Can use getVariables to access scene variables', () => {
      window.__grafanaSceneContext = new EmbeddedScene({
        $variables: new SceneVariableSet({
          variables: [
            new QueryVariable({ name: 'server', value: 'serverA', text: 'Server A', query: { refId: 'A' } }),
            new QueryVariable({ name: 'pods', value: ['pA', 'pB'], text: ['podA', 'podB'], query: { refId: 'A' } }),
            new DataSourceVariable({ name: 'ds', value: 'dsA', text: 'dsA', pluginId: 'prometheus' }),
            new CustomVariable({ name: 'custom', value: 'A', text: 'A', query: 'A, B, C' }),
            new IntervalVariable({ name: 'interval', value: '1m', intervals: ['1m', '2m'] }),
          ],
        }),
        body: new SceneCanvasText({ text: 'hello' }),
      });

      window.__grafanaSceneContext.activate();

      const vars = _templateSrv.getVariables();
      expect(vars.length).toBe(5);

      const serverVar = vars[0] as QueryVariableModel;

      expect(serverVar.name).toBe('server');
      expect(serverVar.type).toBe('query');
      expect(serverVar.current.value).toBe('serverA');
      expect(serverVar.current.text).toBe('Server A');

      const podVar = vars[1] as QueryVariableModel;

      expect(podVar.name).toBe('pods');
      expect(podVar.type).toBe('query');
      expect(podVar.current.value).toEqual(['pA', 'pB']);
      expect(podVar.current.text).toEqual(['podA', 'podB']);
    });

    it('Should return timeRange from scenes context', () => {
      window.__grafanaSceneContext = new EmbeddedScene({
        body: new SceneCanvasText({ text: 'hello' }),
      });
      _templateSrv.updateTimeRange({
        from: dateTime(1594671549254),
        to: dateTime(1594671549254),
        raw: { from: '10', to: '10' },
      });

      const deactivate = window.__grafanaSceneContext.activate();

      expect(_templateSrv.timeRange).not.toBeNull();
      expect(_templateSrv.timeRange).not.toBeUndefined();
      expect(_templateSrv.timeRange!.raw).toEqual({ from: '12', to: '14' });
      expect(timeRangeMock).toHaveBeenCalled();

      deactivate();

      expect(_templateSrv.timeRange!.raw).toEqual({ from: '10', to: '10' });
    });
  });
});
