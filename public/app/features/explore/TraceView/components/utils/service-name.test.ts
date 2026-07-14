import { type TraceProcess } from '../types/trace';

import { getServiceDisplayName, getServiceColorKey } from './service-name';

describe('getServiceDisplayName', () => {
  it('returns only service name when serviceNamespace is not present', () => {
    const process: TraceProcess = {
      serviceName: 'cart-service',
      tags: [],
    };
    expect(getServiceDisplayName(process)).toBe('cart-service');
  });

  it('returns namespace/serviceName when serviceNamespace is present', () => {
    const process: TraceProcess = {
      serviceName: 'cart-service',
      serviceNamespace: 'production',
      tags: [],
    };
    expect(getServiceDisplayName(process)).toBe('production/cart-service');
  });

  it('handles empty serviceName with namespace', () => {
    const process: TraceProcess = {
      serviceName: '',
      serviceNamespace: 'staging',
      tags: [],
    };
    expect(getServiceDisplayName(process)).toBe('staging/');
  });
});

describe('getServiceColorKey', () => {
  it('returns the same value as getServiceDisplayName for color/deduplication', () => {
    const withNamespace: TraceProcess = {
      serviceName: 'api',
      serviceNamespace: 'team-a',
      tags: [],
    };
    const withoutNamespace: TraceProcess = {
      serviceName: 'api',
      tags: [],
    };
    expect(getServiceColorKey(withNamespace)).toBe('team-a/api');
    expect(getServiceColorKey(withoutNamespace)).toBe('api');
  });

  it('produces distinct keys for same serviceName in different namespaces', () => {
    const staging: TraceProcess = { serviceName: 'cart-service', serviceNamespace: 'staging', tags: [] };
    const production: TraceProcess = { serviceName: 'cart-service', serviceNamespace: 'production', tags: [] };
    expect(getServiceColorKey(staging)).toBe('staging/cart-service');
    expect(getServiceColorKey(production)).toBe('production/cart-service');
    expect(getServiceColorKey(staging)).not.toBe(getServiceColorKey(production));
  });
});
