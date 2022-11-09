import { VariableValue } from '../types';
import { TestVariable } from '../variants/TestVariable';

import { formatRegistry, FormatRegistryID } from './formatRegistry';

function formatValue<T extends VariableValue>(
  formatId: FormatRegistryID,
  value: T,
  text?: string,
  args: string[] = []
): string {
  const variable = new TestVariable({ name: 'server', value, text });
  return formatRegistry.get(formatId).formatter(value, args, variable);
}

describe('formatRegistry', () => {
  it('Can format values acccording to format', () => {
    expect(formatValue(FormatRegistryID.lucene, 'foo bar')).toBe('foo\\ bar');
    expect(formatValue(FormatRegistryID.lucene, '-1')).toBe('-1');
    expect(formatValue(FormatRegistryID.lucene, '-test')).toBe('\\-test');
    expect(formatValue(FormatRegistryID.lucene, ['foo bar', 'baz'])).toBe('("foo\\ bar" OR "baz")');
    expect(formatValue(FormatRegistryID.lucene, [])).toBe('__empty__');

    expect(formatValue(FormatRegistryID.glob, 'foo')).toBe('foo');
    expect(formatValue(FormatRegistryID.glob, ['AA', 'BB', 'C.*'])).toBe('{AA,BB,C.*}');

    expect(formatValue(FormatRegistryID.text, 'v', 'display text')).toBe('display text');

    expect(formatValue(FormatRegistryID.raw, [12, 13])).toBe('12,13');
    expect(formatValue(FormatRegistryID.raw, '#Æ³ ̇¹"Ä1"#!"#!½')).toBe('#Æ³ ̇¹"Ä1"#!"#!½');

    expect(formatValue(FormatRegistryID.regex, 'test.')).toBe('test\\.');
    expect(formatValue(FormatRegistryID.regex, ['test.'])).toBe('test\\.');
    expect(formatValue(FormatRegistryID.regex, ['test.', 'test2'])).toBe('(test\\.|test2)');

    expect(formatValue(FormatRegistryID.pipe, ['test', 'test2'])).toBe('test|test2');

    expect(formatValue(FormatRegistryID.distributed, ['test'])).toBe('test');
    expect(formatValue(FormatRegistryID.distributed, ['test', 'test2'])).toBe('test,server=test2');

    expect(formatValue(FormatRegistryID.csv, 'test')).toBe('test');
    expect(formatValue(FormatRegistryID.csv, ['test', 'test2'])).toBe('test,test2');

    expect(formatValue(FormatRegistryID.html, '<script>alert(asd)</script>')).toBe(
      '&lt;script&gt;alert(asd)&lt;/script&gt;'
    );

    expect(formatValue(FormatRegistryID.json, ['test', 12])).toBe('["test",12]');

    expect(formatValue(FormatRegistryID.percentEncode, ['foo()bar BAZ', 'test2'])).toBe(
      '%7Bfoo%28%29bar%20BAZ%2Ctest2%7D'
    );

    expect(formatValue(FormatRegistryID.singleQuote, 'test')).toBe(`'test'`);
    expect(formatValue(FormatRegistryID.singleQuote, ['test', `test'2`])).toBe("'test','test\\'2'");

    expect(formatValue(FormatRegistryID.doubleQuote, 'test')).toBe(`"test"`);
    expect(formatValue(FormatRegistryID.doubleQuote, ['test', `test"2`])).toBe('"test","test\\"2"');

    expect(formatValue(FormatRegistryID.sqlString, "test'value")).toBe(`'test''value'`);
    expect(formatValue(FormatRegistryID.sqlString, ['test', "test'value2"])).toBe(`'test','test''value2'`);

    expect(formatValue(FormatRegistryID.date, 1594671549254)).toBe('2020-07-13T20:19:09.254Z');
    expect(formatValue(FormatRegistryID.date, 1594671549254, 'text', ['seconds'])).toBe('1594671549');
    expect(formatValue(FormatRegistryID.date, 1594671549254, 'text', ['iso'])).toBe('2020-07-13T20:19:09.254Z');
    expect(formatValue(FormatRegistryID.date, 1594671549254, 'text', ['YYYY-MM'])).toBe('2020-07');
  });
});
