import { TemplateSrv } from './template_srv';
import { convertToStoreState } from 'test/helpers/convertToStoreState';
import { getTemplateSrvDependencies } from '../../../test/helpers/getTemplateSrvDependencies';
import { variableAdapters } from '../variables/adapters';
import { createQueryVariableAdapter } from '../variables/query/adapter';
import { dateTime, TimeRange } from '@grafana/data';

describe('templateSrv', () => {
  let _templateSrv: any;

  function initTemplateSrv(variables: any[], timeRange?: TimeRange) {
    const state = convertToStoreState(variables);

    _templateSrv = new TemplateSrv(getTemplateSrvDependencies(state));
    _templateSrv.init(variables, timeRange);
  }

  describe('init', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should initialize template data', () => {
      const target = _templateSrv.replace('this.[[test]].filters');
      expect(target).toBe('this.oogle.filters');
    });
  });

  describe('replace can pass scoped vars', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('scoped vars should support objects', () => {
      const target = _templateSrv.replace('${series.name} ${series.nested.field}', {
        series: { value: { name: 'Server1', nested: { field: 'nested' } } },
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
        series: { value: { name: 'Server1', nested: { 'field.with.dot': 'nested' } } },
      });
      expect(target).toBe('Server1 nested');
    });

    it('scoped vars should support arrays of objects', () => {
      const target = _templateSrv.replace('${series.rows[0].name} ${series.rows[1].name}', {
        series: { value: { rows: [{ name: 'first' }, { name: 'second' }] } },
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

  describe('getAdhocFilters', () => {
    beforeEach(() => {
      initTemplateSrv([
        {
          type: 'datasource',
          name: 'ds',
          current: { value: 'logstash', text: 'logstash' },
        },
        { type: 'adhoc', name: 'test', datasource: 'oogle', filters: [1] },
        { type: 'adhoc', name: 'test2', datasource: '$ds', filters: [2] },
      ]);
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
      initTemplateSrv([
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
        initTemplateSrv([
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
      initTemplateSrv([
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
  });

  describe('variable with all option and custom value', () => {
    beforeEach(() => {
      initTemplateSrv([
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

    it('should not escape custom all value', () => {
      const target = _templateSrv.replace('this.$test', {}, 'regex');
      expect(target).toBe('this.*');
    });
  });

  describe('lucene format', () => {
    it('should properly escape $test with lucene escape sequences', () => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:$test', {}, 'lucene');
      expect(target).toBe('this:value\\/4');
    });

    it('should properly escape ${test} with lucene escape sequences', () => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:${test}', {}, 'lucene');
      expect(target).toBe('this:value\\/4');
    });

    it('should properly escape ${test:lucene} with lucene escape sequences', () => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
      const target = _templateSrv.replace('this:${test:lucene}', {});
      expect(target).toBe('this:value\\/4');
    });
  });

  describe('html format', () => {
    it('should encode values html escape sequences', () => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: '<script>alert(asd)</script>' } }]);
      const target = _templateSrv.replace('$test', {}, 'html');
      expect(target).toBe('&lt;script&gt;alert(asd)&lt;/script&gt;');
    });
  });

  describe('format variable to string values', () => {
    it('single value should return value', () => {
      const result = _templateSrv.formatValue('test');
      expect(result).toBe('test');
    });

    it('multi value and glob format should render glob string', () => {
      const result = _templateSrv.formatValue(['test', 'test2'], 'glob');
      expect(result).toBe('{test,test2}');
    });

    it('multi value and lucene should render as lucene expr', () => {
      const result = _templateSrv.formatValue(['test', 'test2'], 'lucene');
      expect(result).toBe('("test" OR "test2")');
    });

    it('multi value and regex format should render regex string', () => {
      const result = _templateSrv.formatValue(['test.', 'test2'], 'regex');
      expect(result).toBe('(test\\.|test2)');
    });

    it('multi value and pipe should render pipe string', () => {
      const result = _templateSrv.formatValue(['test', 'test2'], 'pipe');
      expect(result).toBe('test|test2');
    });

    it('multi value and distributed should render distributed string', () => {
      const result = _templateSrv.formatValue(['test', 'test2'], 'distributed', {
        name: 'build',
      });
      expect(result).toBe('test,build=test2');
    });

    it('multi value and distributed should render when not string', () => {
      const result = _templateSrv.formatValue(['test'], 'distributed', {
        name: 'build',
      });
      expect(result).toBe('test');
    });

    it('multi value and csv format should render csv string', () => {
      const result = _templateSrv.formatValue(['test', 'test2'], 'csv');
      expect(result).toBe('test,test2');
    });

    it('multi value and percentencode format should render percent-encoded string', () => {
      const result = _templateSrv.formatValue(['foo()bar BAZ', 'test2'], 'percentencode');
      expect(result).toBe('%7Bfoo%28%29bar%20BAZ%2Ctest2%7D');
    });

    it('slash should be properly escaped in regex format', () => {
      const result = _templateSrv.formatValue('Gi3/14', 'regex');
      expect(result).toBe('Gi3\\/14');
    });

    it('single value and singlequote format should render string with value enclosed in single quotes', () => {
      const result = _templateSrv.formatValue('test', 'singlequote');
      expect(result).toBe("'test'");
    });

    it('multi value and singlequote format should render string with values enclosed in single quotes', () => {
      const result = _templateSrv.formatValue(['test', "test'2"], 'singlequote');
      expect(result).toBe("'test','test\\'2'");
    });

    it('single value and doublequote format should render string with value enclosed in double quotes', () => {
      const result = _templateSrv.formatValue('test', 'doublequote');
      expect(result).toBe('"test"');
    });

    it('multi value and doublequote format should render string with values enclosed in double quotes', () => {
      const result = _templateSrv.formatValue(['test', 'test"2'], 'doublequote');
      expect(result).toBe('"test","test\\"2"');
    });

    it('single value and sqlstring format should render string with value enclosed in single quotes', () => {
      const result = _templateSrv.formatValue("test'value", 'sqlstring');
      expect(result).toBe(`'test''value'`);
    });

    it('multi value and sqlstring format should render string with values enclosed in single quotes', () => {
      const result = _templateSrv.formatValue(['test', "test'value2"], 'sqlstring');
      expect(result).toBe(`'test','test''value2'`);
    });

    it('raw format should leave value intact and do no escaping', () => {
      const result = _templateSrv.formatValue("'test\n", 'raw');
      expect(result).toBe("'test\n");
    });
  });

  describe('can check if variable exists', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
    });

    it('should return true if $test exists', () => {
      const result = _templateSrv.variableExists('$test');
      expect(result).toBe(true);
    });

    it('should return true if $test exists in string', () => {
      const result = _templateSrv.variableExists('something $test something');
      expect(result).toBe(true);
    });

    it('should return true if [[test]] exists in string', () => {
      const result = _templateSrv.variableExists('something [[test]] something');
      expect(result).toBe(true);
    });

    it('should return true if [[test:csv]] exists in string', () => {
      const result = _templateSrv.variableExists('something [[test:csv]] something');
      expect(result).toBe(true);
    });

    it('should return true if ${test} exists in string', () => {
      const result = _templateSrv.variableExists('something ${test} something');
      expect(result).toBe(true);
    });

    it('should return true if ${test:raw} exists in string', () => {
      const result = _templateSrv.variableExists('something ${test:raw} something');
      expect(result).toBe(true);
    });

    it('should return null if there are no variables in string', () => {
      const result = _templateSrv.variableExists('string without variables');
      expect(result).toBe(false);
    });
  });

  describe('can highlight variables in string', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
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
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'muuuu' } }]);
    });

    it('should set current value and update template data', () => {
      const target = _templateSrv.replace('this.[[test]].filters');
      expect(target).toBe('this.muuuu.filters');
    });
  });

  describe('fillVariableValuesForUrl with multi value', () => {
    beforeAll(() => {
      variableAdapters.register(createQueryVariableAdapter());
    });
    beforeEach(() => {
      initTemplateSrv([
        {
          type: 'query',
          name: 'test',
          current: { value: ['val1', 'val2'] },
          getValueForUrl: function() {
            return this.current.value;
          },
        },
      ]);
    });

    it('should set multiple url params', () => {
      const params: any = {};
      _templateSrv.fillVariableValuesForUrl(params);
      expect(params['var-test']).toMatchObject(['val1', 'val2']);
    });
  });

  describe('fillVariableValuesForUrl skip url sync', () => {
    beforeEach(() => {
      initTemplateSrv([
        {
          name: 'test',
          skipUrlSync: true,
          current: { value: 'value' },
          getValueForUrl: function() {
            return this.current.value;
          },
        },
      ]);
    });

    it('should not include template variable value in url', () => {
      const params: any = {};
      _templateSrv.fillVariableValuesForUrl(params);
      expect(params['var-test']).toBe(undefined);
    });
  });

  describe('fillVariableValuesForUrl with multi value with skip url sync', () => {
    beforeEach(() => {
      initTemplateSrv([
        {
          type: 'query',
          name: 'test',
          skipUrlSync: true,
          current: { value: ['val1', 'val2'] },
          getValueForUrl: function() {
            return this.current.value;
          },
        },
      ]);
    });

    it('should not include template variable value in url', () => {
      const params: any = {};
      _templateSrv.fillVariableValuesForUrl(params);
      expect(params['var-test']).toBe(undefined);
    });
  });

  describe('fillVariableValuesForUrl with multi value and scopedVars', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]);
    });

    it('should set scoped value as url params', () => {
      const params: any = {};
      _templateSrv.fillVariableValuesForUrl(params, {
        test: { value: 'val1' },
      });
      expect(params['var-test']).toBe('val1');
    });
  });

  describe('fillVariableValuesForUrl with multi value, scopedVars and skip url sync', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]);
    });

    it('should not set scoped value as url params', () => {
      const params: any = {};
      _templateSrv.fillVariableValuesForUrl(params, {
        test: { name: 'test', value: 'val1', skipUrlSync: true },
      });
      expect(params['var-test']).toBe(undefined);
    });
  });

  describe('replaceWithText', () => {
    beforeEach(() => {
      initTemplateSrv([
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
      initTemplateSrv([
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
  });

  describe('built in interval variables', () => {
    beforeEach(() => {
      initTemplateSrv([]);
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
      initTemplateSrv([], {
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
});
