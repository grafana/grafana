import { KnownProvenance } from '../../types/knownProvenance';

import { PROVENANCE_NONE } from './constants';
import { encodeFieldSelector, isProvisionedResource } from './utils';

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

describe('isProvisionedResource', () => {
  it('should return true when provenance is API', () => {
    expect(isProvisionedResource(KnownProvenance.API)).toBe(true);
  });

  it('should return true when provenance is File', () => {
    expect(isProvisionedResource(KnownProvenance.File)).toBe(true);
  });

  it('should return true when provenance is ConvertedPrometheus', () => {
    expect(isProvisionedResource(KnownProvenance.ConvertedPrometheus)).toBe(true);
  });

  it('should return true when provenance is an empty string', () => {
    expect(isProvisionedResource(KnownProvenance.None)).toBe(false);
  });

  it('should return false when provenance is none', () => {
    expect(isProvisionedResource(PROVENANCE_NONE)).toBe(false);
  });

  it('should return false when provenance is undefined', () => {
    expect(isProvisionedResource(undefined)).toBe(false);
  });

  it('should return true for any other non-empty string', () => {
    expect(isProvisionedResource('custom-provenance')).toBe(true);
  });
});
