import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';

import { config } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { getDataSourceForQuery, getDefaultDataSourceRef, getDefaultDatasource } from './datasourceReferences';

beforeEach(() => {
  jest.replaceProperty(config, 'defaultDatasource', 'Metrics');
  jest.replaceProperty(config, 'datasources', {
    OtherMetrics: makeDataSourceSettings('other-prometheus', 'OtherMetrics', 'prometheus'),
    Logs: makeDataSourceSettings('loki-uid', 'Logs', 'loki'),
    Metrics: {
      ...makeDataSourceSettings('default-prometheus', 'Metrics', 'prometheus', { isDefault: true }),
      apiVersion: 'v2',
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getDataSourceForQuery', () => {
  it('returns an explicit UID reference by identity even when its type differs from the query kind', () => {
    const datasource: DataSourceRef = { uid: 'external-uid', type: 'elasticsearch', apiVersion: 'v1' };

    expect(getDataSourceForQuery(datasource, 'prometheus')).toBe(datasource);
  });

  it('prefers the matching default over an earlier datasource of the same type', () => {
    expect(getDataSourceForQuery(undefined, 'prometheus')).toStrictEqual({
      uid: 'default-prometheus',
      type: 'prometheus',
    });
  });

  it('resolves another matching type when the default does not match', () => {
    expect(getDataSourceForQuery(null, 'loki')).toStrictEqual({ uid: 'loki-uid', type: 'loki' });
  });

  it('falls back to the default and warns when no datasource matches the query kind', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(getDataSourceForQuery({ type: 'tempo' }, 'tempo')).toStrictEqual({
      uid: 'default-prometheus',
      type: 'prometheus',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Could not find datasource for query kind tempo, defaulting to prometheus');
  });

  it('throws when no datasource matches and the configured default is missing', () => {
    jest.replaceProperty(config, 'defaultDatasource', 'Missing');

    expect(() => getDataSourceForQuery(undefined, 'tempo')).toThrow(
      'Default datasource Missing not found in datasource list'
    );
  });
});

describe('getDefaultDataSourceRef', () => {
  it('returns only the configured default UID and type, without its API version', () => {
    expect(getDefaultDataSourceRef()).toStrictEqual({ uid: 'default-prometheus', type: 'prometheus' });
  });

  it('falls back to Grafana when the configured default is missing', () => {
    jest.replaceProperty(config, 'defaultDatasource', 'Missing');

    expect(getDefaultDataSourceRef()).toStrictEqual({ uid: '-- Grafana --', type: 'grafana' });
  });
});

describe('getDefaultDatasource', () => {
  it('includes the API version of the configured default', () => {
    expect(getDefaultDatasource()).toStrictEqual({
      uid: 'default-prometheus',
      type: 'prometheus',
      apiVersion: 'v2',
    });
  });

  it('returns an undefined API version when the configured default has none', () => {
    jest.replaceProperty(
      config.datasources,
      'Metrics',
      makeDataSourceSettings('default-prometheus', 'Metrics', 'prometheus', { isDefault: true })
    );

    expect(getDefaultDatasource()).toStrictEqual({
      uid: 'default-prometheus',
      type: 'prometheus',
      apiVersion: undefined,
    });
  });
});
