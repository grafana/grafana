import { silenceConsoleOutput } from 'test/core/utils/silenceConsoleOutput';

import { VariableFormatID } from '@grafana/schema';

import { formatVariableValue } from './formatVariableValue';

describe('format variable to string values', () => {
  silenceConsoleOutput();

  it('single value should return value', () => {
    const result = formatVariableValue('test');
    expect(result).toBe('test');
  });

  it('should use glob format when unknown format provided', () => {
    let result = formatVariableValue('test', 'nonexistentformat');
    expect(result).toBe('test');
    result = formatVariableValue(['test', 'test1'], 'nonexistentformat');
    expect(result).toBe('{test,test1}');
  });

  it('multi value and glob format should render glob string', () => {
    const result = formatVariableValue(['test', 'test2'], 'glob');
    expect(result).toBe('{test,test2}');
  });

  it('multi value and lucene should render as lucene expr', () => {
    const result = formatVariableValue(['test', 'test2'], 'lucene');
    expect(result).toBe('("test" OR "test2")');
  });

  it('multi value and regex format should render regex string', () => {
    const result = formatVariableValue(['test.', 'test2'], 'regex');
    expect(result).toBe('(test\\.|test2)');
  });

  it('multi value and pipe should render pipe string', () => {
    const result = formatVariableValue(['test', 'test2'], 'pipe');
    expect(result).toBe('test|test2');
  });

  it('multi value and distributed should render distributed string', () => {
    const result = formatVariableValue(['test', 'test2'], 'distributed', {
      name: 'build',
    });
    expect(result).toBe('test,build=test2');
  });

  it('multi value and distributed should render when not string', () => {
    const result = formatVariableValue(['test'], 'distributed', {
      name: 'build',
    });
    expect(result).toBe('test');
  });

  it('multi value and csv format should render csv string', () => {
    const result = formatVariableValue(['test', 'test2'], VariableFormatID.CSV);
    expect(result).toBe('test,test2');
  });

  it('multi value and percentencode format should render percent-encoded string', () => {
    const result = formatVariableValue(['foo()bar BAZ', 'test2'], VariableFormatID.PercentEncode);
    expect(result).toBe('%7Bfoo%28%29bar%20BAZ%2Ctest2%7D');
  });

  it('slash should be properly escaped in regex format', () => {
    const result = formatVariableValue('Gi3/14', 'regex');
    expect(result).toBe('Gi3\\/14');
  });

  it('single value and singlequote format should render string with value enclosed in single quotes', () => {
    const result = formatVariableValue('test', 'singlequote');
    expect(result).toBe("'test'");
  });

  it('multi value and singlequote format should render string with values enclosed in single quotes', () => {
    const result = formatVariableValue(['test', "test'2"], 'singlequote');
    expect(result).toBe("'test','test\\'2'");
  });

  it('single value and doublequote format should render string with value enclosed in double quotes', () => {
    const result = formatVariableValue('test', 'doublequote');
    expect(result).toBe('"test"');
  });

  it('multi value and doublequote format should render string with values enclosed in double quotes', () => {
    const result = formatVariableValue(['test', 'test"2'], 'doublequote');
    expect(result).toBe('"test","test\\"2"');
  });

  it('single value and sqlstring format should render string with value enclosed in single quotes', () => {
    const result = formatVariableValue("test'value", 'sqlstring');
    expect(result).toBe(`'test''value'`);
  });

  it('multi value and sqlstring format should render string with values enclosed in single quotes', () => {
    const result = formatVariableValue(['test', "test'value2"], 'sqlstring');
    expect(result).toBe(`'test','test''value2'`);
  });

  it('raw format should leave value intact and do no escaping', () => {
    const result = formatVariableValue("'test\n", 'raw');
    expect(result).toBe("'test\n");
  });
});
