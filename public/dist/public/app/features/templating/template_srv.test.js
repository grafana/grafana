import { __values } from "tslib";
import { dateTime } from '@grafana/data';
import { initTemplateSrv } from '../../../test/helpers/initTemplateSrv';
import { silenceConsoleOutput } from '../../../test/core/utils/silenceConsoleOutput';
import { variableAdapters } from '../variables/adapters';
import { createQueryVariableAdapter } from '../variables/query/adapter';
import { createAdHocVariableAdapter } from '../variables/adhoc/adapter';
import { FormatRegistryID } from './formatRegistry';
import { setDataSourceSrv } from '@grafana/runtime';
import { mockDataSource, MockDataSourceSrv } from '../alerting/unified/mocks';
variableAdapters.setInit(function () { return [
    createQueryVariableAdapter(),
    createAdHocVariableAdapter(),
]; });
describe('templateSrv', function () {
    silenceConsoleOutput();
    var _templateSrv;
    describe('init', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
        });
        it('should initialize template data', function () {
            var target = _templateSrv.replace('this.[[test]].filters');
            expect(target).toBe('this.oogle.filters');
        });
    });
    describe('replace can pass scoped vars', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
        });
        it('scoped vars should support objects', function () {
            var target = _templateSrv.replace('${series.name} ${series.nested.field}', {
                series: { value: { name: 'Server1', nested: { field: 'nested' } } },
            });
            expect(target).toBe('Server1 nested');
        });
        it('built in vars should support objects', function () {
            _templateSrv.setGlobalVariable('__dashboard', {
                value: { name: 'hello' },
            });
            var target = _templateSrv.replace('${__dashboard.name}');
            expect(target).toBe('hello');
        });
        it('scoped vars should support objects with propert names with dot', function () {
            var target = _templateSrv.replace('${series.name} ${series.nested["field.with.dot"]}', {
                series: { value: { name: 'Server1', nested: { 'field.with.dot': 'nested' } } },
            });
            expect(target).toBe('Server1 nested');
        });
        it('scoped vars should support arrays of objects', function () {
            var target = _templateSrv.replace('${series.rows[0].name} ${series.rows[1].name}', {
                series: { value: { rows: [{ name: 'first' }, { name: 'second' }] } },
            });
            expect(target).toBe('first second');
        });
        it('should replace $test with scoped value', function () {
            var target = _templateSrv.replace('this.$test.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.mupp.filters');
        });
        it('should replace ${test} with scoped value', function () {
            var target = _templateSrv.replace('this.${test}.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.mupp.filters');
        });
        it('should replace ${test:glob} with scoped value', function () {
            var target = _templateSrv.replace('this.${test:glob}.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.mupp.filters');
        });
        it('should replace $test with scoped text', function () {
            var target = _templateSrv.replaceWithText('this.$test.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.asd.filters');
        });
        it('should replace ${test} with scoped text', function () {
            var target = _templateSrv.replaceWithText('this.${test}.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.asd.filters');
        });
        it('should replace ${test.name} with scoped text', function () {
            var target = _templateSrv.replaceWithText('this.${test.name}.filters', {
                test: { value: { name: 'mupp' }, text: 'asd' },
            });
            expect(target).toBe('this.mupp.filters');
        });
        it('should not replace ${test:glob} with scoped text', function () {
            var target = _templateSrv.replaceWithText('this.${test:glob}.filters', {
                test: { value: 'mupp', text: 'asd' },
            });
            expect(target).toBe('this.mupp.filters');
        });
    });
    describe('getAdhocFilters', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
                {
                    type: 'datasource',
                    name: 'ds',
                    current: { value: 'logstash', text: 'logstash' },
                },
                { type: 'adhoc', name: 'test', datasource: { uid: 'oogle' }, filters: [1] },
                { type: 'adhoc', name: 'test2', datasource: { uid: '$ds' }, filters: [2] },
            ]);
            setDataSourceSrv(new MockDataSourceSrv({
                oogle: mockDataSource({
                    name: 'oogle',
                    uid: 'oogle',
                }),
            }));
        });
        it('should return filters if datasourceName match', function () {
            var filters = _templateSrv.getAdhocFilters('oogle');
            expect(filters).toMatchObject([1]);
        });
        it('should return empty array if datasourceName does not match', function () {
            var filters = _templateSrv.getAdhocFilters('oogleasdasd');
            expect(filters).toMatchObject([]);
        });
        it('should return filters when datasourceName match via data source variable', function () {
            var filters = _templateSrv.getAdhocFilters('logstash');
            expect(filters).toMatchObject([2]);
        });
    });
    describe('replace can pass multi / all format', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
                {
                    type: 'query',
                    name: 'test',
                    current: { value: ['value1', 'value2'] },
                },
            ]);
        });
        it('should replace $test with globbed value', function () {
            var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
            expect(target).toBe('this.{value1,value2}.filters');
        });
        describe('when the globbed variable only has one value', function () {
            beforeEach(function () {
                _templateSrv = initTemplateSrv([
                    {
                        type: 'query',
                        name: 'test',
                        current: { value: ['value1'] },
                    },
                ]);
            });
            it('should not glob the value', function () {
                var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
                expect(target).toBe('this.value1.filters');
            });
        });
        it('should replace ${test} with globbed value', function () {
            var target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
            expect(target).toBe('this.{value1,value2}.filters');
        });
        it('should replace ${test:glob} with globbed value', function () {
            var target = _templateSrv.replace('this.${test:glob}.filters', {});
            expect(target).toBe('this.{value1,value2}.filters');
        });
        it('should replace $test with piped value', function () {
            var target = _templateSrv.replace('this=$test', {}, 'pipe');
            expect(target).toBe('this=value1|value2');
        });
        it('should replace ${test} with piped value', function () {
            var target = _templateSrv.replace('this=${test}', {}, 'pipe');
            expect(target).toBe('this=value1|value2');
        });
        it('should replace ${test:pipe} with piped value', function () {
            var target = _templateSrv.replace('this=${test:pipe}', {});
            expect(target).toBe('this=value1|value2');
        });
        it('should replace ${test:pipe} with piped value and $test with globbed value', function () {
            var target = _templateSrv.replace('${test:pipe},$test', {}, 'glob');
            expect(target).toBe('value1|value2,{value1,value2}');
        });
    });
    describe('variable with all option', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
                {
                    type: 'query',
                    name: 'test',
                    current: { value: '$__all' },
                    options: [{ value: '$__all' }, { value: 'value1' }, { value: 'value2' }],
                },
            ]);
        });
        it('should replace $test with formatted all value', function () {
            var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
            expect(target).toBe('this.{value1,value2}.filters');
        });
        it('should replace ${test} with formatted all value', function () {
            var target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
            expect(target).toBe('this.{value1,value2}.filters');
        });
        it('should replace ${test:glob} with formatted all value', function () {
            var target = _templateSrv.replace('this.${test:glob}.filters', {});
            expect(target).toBe('this.{value1,value2}.filters');
        });
        it('should replace ${test:pipe} with piped value and $test with globbed value', function () {
            var target = _templateSrv.replace('${test:pipe},$test', {}, 'glob');
            expect(target).toBe('value1|value2,{value1,value2}');
        });
        it('should replace ${test:queryparam} with correct query parameter', function () {
            var target = _templateSrv.replace('${test:queryparam}', {});
            expect(target).toBe('var-test=All');
        });
    });
    describe('variable with all option and custom value', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
                {
                    type: 'query',
                    name: 'test',
                    current: { value: '$__all' },
                    allValue: '*',
                    options: [{ value: 'value1' }, { value: 'value2' }],
                },
            ]);
        });
        it('should replace $test with formatted all value', function () {
            var target = _templateSrv.replace('this.$test.filters', {}, 'glob');
            expect(target).toBe('this.*.filters');
        });
        it('should replace ${test} with formatted all value', function () {
            var target = _templateSrv.replace('this.${test}.filters', {}, 'glob');
            expect(target).toBe('this.*.filters');
        });
        it('should replace ${test:glob} with formatted all value', function () {
            var target = _templateSrv.replace('this.${test:glob}.filters', {});
            expect(target).toBe('this.*.filters');
        });
        it('should replace ${test:text} with "all" value', function () {
            var target = _templateSrv.replace('this.${test:text}.filters', {});
            expect(target).toBe('this.All.filters');
        });
        it('should not escape custom all value', function () {
            var target = _templateSrv.replace('this.$test', {}, 'regex');
            expect(target).toBe('this.*');
        });
        it('should replace ${test:queryparam} with correct query parameter', function () {
            var target = _templateSrv.replace('${test:queryparam}', {});
            expect(target).toBe('var-test=All');
        });
    });
    describe('lucene format', function () {
        it('should properly escape $test with lucene escape sequences', function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
            var target = _templateSrv.replace('this:$test', {}, 'lucene');
            expect(target).toBe('this:value\\/4');
        });
        it('should properly escape ${test} with lucene escape sequences', function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
            var target = _templateSrv.replace('this:${test}', {}, 'lucene');
            expect(target).toBe('this:value\\/4');
        });
        it('should properly escape ${test:lucene} with lucene escape sequences', function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'value/4' } }]);
            var target = _templateSrv.replace('this:${test:lucene}', {});
            expect(target).toBe('this:value\\/4');
        });
    });
    describe('html format', function () {
        it('should encode values html escape sequences', function () {
            _templateSrv = initTemplateSrv([
                { type: 'query', name: 'test', current: { value: '<script>alert(asd)</script>' } },
            ]);
            var target = _templateSrv.replace('$test', {}, 'html');
            expect(target).toBe('&lt;script&gt;alert(asd)&lt;/script&gt;');
        });
    });
    describe('format variable to string values', function () {
        it('single value should return value', function () {
            var result = _templateSrv.formatValue('test');
            expect(result).toBe('test');
        });
        it('should use glob format when unknown format provided', function () {
            var result = _templateSrv.formatValue('test', 'nonexistentformat');
            expect(result).toBe('test');
            result = _templateSrv.formatValue(['test', 'test1'], 'nonexistentformat');
            expect(result).toBe('{test,test1}');
        });
        it('multi value and glob format should render glob string', function () {
            var result = _templateSrv.formatValue(['test', 'test2'], 'glob');
            expect(result).toBe('{test,test2}');
        });
        it('multi value and lucene should render as lucene expr', function () {
            var result = _templateSrv.formatValue(['test', 'test2'], 'lucene');
            expect(result).toBe('("test" OR "test2")');
        });
        it('multi value and regex format should render regex string', function () {
            var result = _templateSrv.formatValue(['test.', 'test2'], 'regex');
            expect(result).toBe('(test\\.|test2)');
        });
        it('multi value and pipe should render pipe string', function () {
            var result = _templateSrv.formatValue(['test', 'test2'], 'pipe');
            expect(result).toBe('test|test2');
        });
        it('multi value and distributed should render distributed string', function () {
            var result = _templateSrv.formatValue(['test', 'test2'], 'distributed', {
                name: 'build',
            });
            expect(result).toBe('test,build=test2');
        });
        it('multi value and distributed should render when not string', function () {
            var result = _templateSrv.formatValue(['test'], 'distributed', {
                name: 'build',
            });
            expect(result).toBe('test');
        });
        it('multi value and csv format should render csv string', function () {
            var result = _templateSrv.formatValue(['test', 'test2'], 'csv');
            expect(result).toBe('test,test2');
        });
        it('multi value and percentencode format should render percent-encoded string', function () {
            var result = _templateSrv.formatValue(['foo()bar BAZ', 'test2'], 'percentencode');
            expect(result).toBe('%7Bfoo%28%29bar%20BAZ%2Ctest2%7D');
        });
        it('slash should be properly escaped in regex format', function () {
            var result = _templateSrv.formatValue('Gi3/14', 'regex');
            expect(result).toBe('Gi3\\/14');
        });
        it('single value and singlequote format should render string with value enclosed in single quotes', function () {
            var result = _templateSrv.formatValue('test', 'singlequote');
            expect(result).toBe("'test'");
        });
        it('multi value and singlequote format should render string with values enclosed in single quotes', function () {
            var result = _templateSrv.formatValue(['test', "test'2"], 'singlequote');
            expect(result).toBe("'test','test\\'2'");
        });
        it('single value and doublequote format should render string with value enclosed in double quotes', function () {
            var result = _templateSrv.formatValue('test', 'doublequote');
            expect(result).toBe('"test"');
        });
        it('multi value and doublequote format should render string with values enclosed in double quotes', function () {
            var result = _templateSrv.formatValue(['test', 'test"2'], 'doublequote');
            expect(result).toBe('"test","test\\"2"');
        });
        it('single value and sqlstring format should render string with value enclosed in single quotes', function () {
            var result = _templateSrv.formatValue("test'value", 'sqlstring');
            expect(result).toBe("'test''value'");
        });
        it('multi value and sqlstring format should render string with values enclosed in single quotes', function () {
            var result = _templateSrv.formatValue(['test', "test'value2"], 'sqlstring');
            expect(result).toBe("'test','test''value2'");
        });
        it('raw format should leave value intact and do no escaping', function () {
            var result = _templateSrv.formatValue("'test\n", 'raw');
            expect(result).toBe("'test\n");
        });
    });
    describe('can check if variable exists', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
        });
        it('should return true if $test exists', function () {
            var result = _templateSrv.variableExists('$test');
            expect(result).toBe(true);
        });
        it('should return true if $test exists in string', function () {
            var result = _templateSrv.variableExists('something $test something');
            expect(result).toBe(true);
        });
        it('should return true if [[test]] exists in string', function () {
            var result = _templateSrv.variableExists('something [[test]] something');
            expect(result).toBe(true);
        });
        it('should return true if [[test:csv]] exists in string', function () {
            var result = _templateSrv.variableExists('something [[test:csv]] something');
            expect(result).toBe(true);
        });
        it('should return true if ${test} exists in string', function () {
            var result = _templateSrv.variableExists('something ${test} something');
            expect(result).toBe(true);
        });
        it('should return true if ${test:raw} exists in string', function () {
            var result = _templateSrv.variableExists('something ${test:raw} something');
            expect(result).toBe(true);
        });
        it('should return null if there are no variables in string', function () {
            var result = _templateSrv.variableExists('string without variables');
            expect(result).toBe(false);
        });
    });
    describe('can highlight variables in string', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'oogle' } }]);
        });
        it('should insert html', function () {
            var result = _templateSrv.highlightVariablesAsHtml('$test');
            expect(result).toBe('<span class="template-variable">$test</span>');
        });
        it('should insert html anywhere in string', function () {
            var result = _templateSrv.highlightVariablesAsHtml('this $test ok');
            expect(result).toBe('this <span class="template-variable">$test</span> ok');
        });
        it('should ignore if variables does not exist', function () {
            var result = _templateSrv.highlightVariablesAsHtml('this $google ok');
            expect(result).toBe('this $google ok');
        });
    });
    describe('updateIndex with simple value', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: 'muuuu' } }]);
        });
        it('should set current value and update template data', function () {
            var target = _templateSrv.replace('this.[[test]].filters');
            expect(target).toBe('this.muuuu.filters');
        });
    });
    describe('replaceWithText', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
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
        it('should replace with text except for grafanaVariables', function () {
            var target = _templateSrv.replaceWithText('Server: $server, period: $period');
            expect(target).toBe('Server: All, period: 13m');
        });
        it('should replace empty string-values with an empty string', function () {
            var target = _templateSrv.replaceWithText('Hello $empty_on_init');
            expect(target).toBe('Hello ');
        });
        it('should not return a string representation of a constructor property', function () {
            var target = _templateSrv.replaceWithText('$foo');
            expect(target).not.toBe('function Object() { [native code] }');
            expect(target).toBe('constructor');
        });
    });
    describe('replaceWithText can pass all / multi value', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
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
        it('should replace with text with variable label', function () {
            var target = _templateSrv.replaceWithText('Server: $server');
            expect(target).toBe('Server: Server 1 + Server 2');
        });
        it('should replace empty string-values with an empty string', function () {
            var target = _templateSrv.replaceWithText('Hello $empty_on_init');
            expect(target).toBe('Hello ');
        });
        it('should replace $__all with All', function () {
            var target = _templateSrv.replaceWithText('Db: $databases');
            expect(target).toBe('Db: All');
        });
        it('should replace $__all with All for values with custom all', function () {
            var target = _templateSrv.replaceWithText('Custom: $custom_all_value');
            expect(target).toBe('Custom: All');
        });
    });
    describe('built in interval variables', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([]);
        });
        it('should replace $__interval_ms with interval milliseconds', function () {
            var target = _templateSrv.replace('10 * $__interval_ms', {
                __interval_ms: { text: '100', value: '100' },
            });
            expect(target).toBe('10 * 100');
        });
    });
    describe('date formating', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([], {
                from: dateTime(1594671549254),
                to: dateTime(1595237229747),
            });
        });
        it('should replace ${__from} with ms epoch value', function () {
            var target = _templateSrv.replace('${__from}');
            expect(target).toBe('1594671549254');
        });
        it('should replace ${__from:date:seconds} with epoch in seconds', function () {
            var target = _templateSrv.replace('${__from:date:seconds}');
            expect(target).toBe('1594671549');
        });
        it('should replace ${__from:date} with iso date', function () {
            var target = _templateSrv.replace('${__from:date}');
            expect(target).toBe('2020-07-13T20:19:09.254Z');
        });
        it('should replace ${__from:date:iso} with iso date', function () {
            var target = _templateSrv.replace('${__from:date:iso}');
            expect(target).toBe('2020-07-13T20:19:09.254Z');
        });
        it('should replace ${__from:date:YYYY-MM} using custom format', function () {
            var target = _templateSrv.replace('${__from:date:YYYY-MM}');
            expect(target).toBe('2020-07');
        });
    });
    describe('handle objects gracefully', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: { test: 'A' } } }]);
        });
        it('should not pass object to custom function', function () {
            var passedValue = null;
            _templateSrv.replace('this.${test}.filters', {}, function (value) {
                passedValue = value;
            });
            expect(passedValue).toBe('[object Object]');
        });
    });
    describe('handle objects gracefully and call toString if defined', function () {
        beforeEach(function () {
            var value = { test: 'A', toString: function () { return 'hello'; } };
            _templateSrv = initTemplateSrv([{ type: 'query', name: 'test', current: { value: value } }]);
        });
        it('should not pass object to custom function', function () {
            var passedValue = null;
            _templateSrv.replace('this.${test}.filters', {}, function (value) {
                passedValue = value;
            });
            expect(passedValue).toBe('hello');
        });
    });
    describe('adhoc variables', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
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
        it("should not be handled by any registry items except for queryparam", function () {
            var e_1, _a;
            var registryItems = Object.values(FormatRegistryID);
            try {
                for (var registryItems_1 = __values(registryItems), registryItems_1_1 = registryItems_1.next(); !registryItems_1_1.done; registryItems_1_1 = registryItems_1.next()) {
                    var registryItem = registryItems_1_1.value;
                    if (registryItem === FormatRegistryID.queryParam) {
                        continue;
                    }
                    var firstTarget = _templateSrv.replace("${adhoc:" + registryItem + "}", {});
                    expect(firstTarget).toBe('');
                    var secondTarget = _templateSrv.replace('${adhoc}', {}, registryItem);
                    expect(secondTarget).toBe('');
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (registryItems_1_1 && !registryItems_1_1.done && (_a = registryItems_1.return)) _a.call(registryItems_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    });
    describe('queryparam', function () {
        beforeEach(function () {
            _templateSrv = initTemplateSrv([
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
        it('query variable with single value with queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace("${single:queryparam}", {});
            expect(target).toBe('var-single=value1');
        });
        it('query variable with single value and queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace('${single}', {}, 'queryparam');
            expect(target).toBe('var-single=value1');
        });
        it('query variable with multi value with queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace("${multi:queryparam}", {});
            expect(target).toBe('var-multi=value1&var-multi=value2');
        });
        it('query variable with multi value and queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace('${multi}', {}, 'queryparam');
            expect(target).toBe('var-multi=value1&var-multi=value2');
        });
        it('query variable with adhoc value with queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace("${adhoc:queryparam}", {});
            expect(target).toBe('var-adhoc=alertstate%7C%3D%7Cfiring&var-adhoc=alertname%7C%3D%7CExampleAlertAlwaysFiring');
        });
        it('query variable with multi value and queryparam format should return correct queryparam', function () {
            var target = _templateSrv.replace('${adhoc}', {}, 'queryparam');
            expect(target).toBe('var-adhoc=alertstate%7C%3D%7Cfiring&var-adhoc=alertname%7C%3D%7CExampleAlertAlwaysFiring');
        });
    });
});
//# sourceMappingURL=template_srv.test.js.map