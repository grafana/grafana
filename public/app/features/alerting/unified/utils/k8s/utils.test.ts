import { KnownProvenance } from '../../types/knownProvenance';

import { K8sAnnotations } from './constants';
import { canTestEntity, encodeFieldSelector, isProvisionedResource, validateRbacEntityName } from './utils';

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

  it('should return false when provenance is none', () => {
    expect(isProvisionedResource(KnownProvenance.None)).toBe(false);
  });

  it('should return false when provenance is undefined', () => {
    expect(isProvisionedResource(undefined)).toBe(false);
  });

  it('should return true for any other non-empty string', () => {
    expect(isProvisionedResource('custom-provenance')).toBe(true);
  });
});

describe('canTestEntity', () => {
  it('should return true when canTest annotation is "true"', () => {
    const entity = {
      metadata: {
        annotations: {
          [K8sAnnotations.AccessTest]: 'true',
        },
      },
    };
    expect(canTestEntity(entity)).toBe(true);
  });

  it('should return false when canTest annotation is "false"', () => {
    const entity = {
      metadata: {
        annotations: {
          [K8sAnnotations.AccessTest]: 'false',
        },
      },
    };
    expect(canTestEntity(entity)).toBe(false);
  });

  it('should return false when canTest annotation is missing', () => {
    const entity = {
      metadata: {
        annotations: {},
      },
    };
    expect(canTestEntity(entity)).toBe(false);
  });

  it('should return false when metadata is undefined', () => {
    const entity = {};
    expect(canTestEntity(entity)).toBe(false);
  });
});

describe('validateRbacEntityName', () => {
  it('returns an error for an empty name', () => {
    expect(validateRbacEntityName('')?.message).toContain('required');
  });

  it('returns an error when name contains a colon', () => {
    expect(validateRbacEntityName('my:route')?.message).toContain(':');
  });

  it('returns an error when name exceeds 40 characters', () => {
    expect(validateRbacEntityName('a'.repeat(41))?.message).toContain('longer than 40');
  });

  it('returns an error when name is not a valid DNS subdomain', () => {
    expect(validateRbacEntityName('My_Route')?.message).toContain('DNS subdomain'); // uppercase + underscore
    expect(validateRbacEntityName('-leading-hyphen')?.message).toContain('DNS subdomain');
    expect(validateRbacEntityName('trailing-hyphen-')?.message).toContain('DNS subdomain');
    expect(validateRbacEntityName('.leading-dot')?.message).toContain('DNS subdomain');
    expect(validateRbacEntityName('trailing-dot.')?.message).toContain('DNS subdomain');
    expect(validateRbacEntityName('illegal@chars!')?.message).toContain('DNS subdomain');
  });

  it('returns undefined for a valid name', () => {
    expect(validateRbacEntityName('my-route.1')).toBeUndefined();
  });
});
