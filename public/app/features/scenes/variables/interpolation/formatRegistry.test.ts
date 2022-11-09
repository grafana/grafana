import { VariableValue } from '../types';
import { TestVariable } from '../variants/TestVariable';

import { formatRegistry, FormatRegistryID } from './formatRegistry';

function formatValue<T extends VariableValue>(formatId: FormatRegistryID, value: T, text?: T) {
  const variable = new TestVariable({ value, text });
  return formatRegistry.get(formatId).formatter(value, [], variable);
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
  });
});
