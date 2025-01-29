import { encodeFieldSelector } from './utils';

describe('encodeFieldSelector', () => {
  it('should escape backslashes', () => {
    expect(encodeFieldSelector('some\\value')).toBe('some\\\\value');
  });

  it('should escape equal signs', () => {
    expect(encodeFieldSelector('key=value')).toBe('key\\=value');
  });

  it('should escape both backslashes and equal signs', () => {
    expect(encodeFieldSelector('key=some\\value=another\\value')).toBe('key\\=some\\\\value\\=another\\\\value');
  });

  it('should handle strings with no backslashes or equal signs', () => {
    expect(encodeFieldSelector('simplevalue')).toBe('simplevalue');
  });

  it('should handle strings with multiple equal signs', () => {
    expect(encodeFieldSelector('key=value=another=value')).toBe('key\\=value\\=another\\=value');
  });
});
