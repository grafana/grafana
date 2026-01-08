import { encodeFieldSelector } from './utils';

describe('encodeFieldSelector', () => {
  it('should escape backslashes', () => {
    expect(encodeFieldSelector('some\\value')).toBe('some\\\\value');
  });

  it('should escape equal signs', () => {
    expect(encodeFieldSelector('key=value')).toBe('key\\=value');
  });

  it('should handle strings with no backslashes or equal signs', () => {
    expect(encodeFieldSelector('simplevalue')).toBe('simplevalue');
  });

  it('should handle strings with multiple equal signs', () => {
    expect(encodeFieldSelector('key=value=another=value')).toBe('key\\=value\\=another\\=value');
  });

  it('should escape commas', () => {
    expect(encodeFieldSelector('value,another')).toBe('value\\,another');
  });

  it('should escape mixed special characters', () => {
    expect(encodeFieldSelector('foo=bar,bar=baz,qux\\foo')).toBe('foo\\=bar\\,bar\\=baz\\,qux\\\\foo');
  });
});
