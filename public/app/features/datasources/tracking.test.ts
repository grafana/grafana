import { getDataSourceAuthType } from './tracking';

describe('getDataSourceAuthType', () => {
  it.each(['grafana-bigquery-datasource', 'stackdriver'])('returns the configured auth type for %s', (pluginId) => {
    expect(getDataSourceAuthType(pluginId, { authenticationType: 'gce' })).toBe('gce');
    expect(getDataSourceAuthType(pluginId, { authenticationType: 'workloadIdentityFederation' })).toBe(
      'workloadIdentityFederation'
    );
    expect(getDataSourceAuthType(pluginId, { authenticationType: 'forwardOAuthIdentity' })).toBe(
      'forwardOAuthIdentity'
    );
  });

  it('defaults to jwt when the auth type is not set', () => {
    expect(getDataSourceAuthType('stackdriver', {})).toBe('jwt');
  });

  it('ignores values outside the known set', () => {
    expect(getDataSourceAuthType('stackdriver', { authenticationType: 'something-else' })).toBeUndefined();
    expect(getDataSourceAuthType('stackdriver', { authenticationType: { nested: true } })).toBeUndefined();
  });

  it('returns undefined for plugins without a resolver', () => {
    expect(getDataSourceAuthType('prometheus', { authenticationType: 'jwt' })).toBeUndefined();
    expect(getDataSourceAuthType('constructor', { authenticationType: 'jwt' })).toBeUndefined();
  });

  it('returns undefined when jsonData is not available', () => {
    expect(getDataSourceAuthType('stackdriver', undefined)).toBeUndefined();
  });
});
