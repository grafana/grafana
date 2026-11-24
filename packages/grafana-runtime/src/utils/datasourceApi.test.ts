import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { config } from '../config';

import { getHealthCheckUrl, supportsDatasourceApi } from './datasourceApi';

const mockGetObjectValue = jest.fn();
jest.mock('../internal/openFeature', () => ({
  ...jest.requireActual('../internal/openFeature'),
  getFeatureFlagClient: () => ({ getObjectValue: mockGetObjectValue }),
}));

function settings(overrides: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  return {
    uid: 'ds-uid',
    type: 'loki',
    name: 'Loki',
    meta: { id: 'loki' } as DataSourcePluginMeta,
    jsonData: {},
    ...overrides,
  } as DataSourceInstanceSettings;
}

function allow(allowed: { health?: string[]; resources?: string[] }) {
  mockGetObjectValue.mockImplementation((key, defaultValue) =>
    key === 'datasources.apiserver.fe-allowed-types' ? allowed : defaultValue
  );
}

describe('supportsDatasourceApi', () => {
  beforeEach(() => {
    mockGetObjectValue.mockReset();
  });

  it('allows a plugin listed for the endpoint', () => {
    allow({ health: ['loki'] });

    expect(supportsDatasourceApi('health', settings())).toBe(true);
    expect(supportsDatasourceApi('resources', settings())).toBe(false);
  });

  it('allows every plugin with a wildcard', () => {
    allow({ health: ['*'] });

    expect(supportsDatasourceApi('health', settings())).toBe(true);
  });

  it('matches the plugin id rather than the instance type', () => {
    allow({ health: ['canonical-id'] });

    expect(
      supportsDatasourceApi('health', settings({ type: 'alias', meta: { id: 'canonical-id' } as DataSourcePluginMeta }))
    ).toBe(true);
  });

  it('keeps OAuth pass-through datasources on the legacy route', () => {
    allow({ health: ['loki'] });

    expect(supportsDatasourceApi('health', settings({ jsonData: { oauthPassThru: true } }))).toBe(false);
  });

  it('rejects a malformed flag value', () => {
    mockGetObjectValue.mockReturnValue(['loki']);

    expect(supportsDatasourceApi('health', settings())).toBe(false);
  });
});

describe('getHealthCheckUrl', () => {
  beforeEach(() => {
    mockGetObjectValue.mockReset();
    config.namespace = 'stacks-1';
  });

  it('uses the legacy route when the plugin is not rolled out', () => {
    allow({ health: [] });

    expect(getHealthCheckUrl(settings())).toBe('/api/datasources/uid/ds-uid/health');
  });

  it('uses the datasource API server route when the plugin is rolled out', () => {
    allow({ health: ['loki'] });

    expect(getHealthCheckUrl(settings())).toBe(
      '/apis/loki.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/ds-uid/health'
    );
  });
});
