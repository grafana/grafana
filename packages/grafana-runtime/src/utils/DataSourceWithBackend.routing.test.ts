import { of } from 'rxjs';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../config';
import { type BackendSrv, getBackendSrv, setBackendSrv } from '../services';

import { DataSourceWithBackend } from './DataSourceWithBackend';

const resourceFlag = 'datasources.apiserver.useNewAPIsForDatasourceResources';
const healthFlag = 'datasourcesApiServerEnableHealthEndpointFrontend';
const allowedTypesFlag = 'datasources.apiserver.fe-allowed-types';
const fetch = jest.fn();

function datasource(type: string, meta?: DataSourcePluginMeta) {
  return new DataSourceWithBackend({
    uid: 'pinot-uid',
    type,
    meta,
    name: 'test',
    jsonData: {},
  } as DataSourceInstanceSettings);
}

describe('datasource resource and health API routing', () => {
  let previousBackend: BackendSrv;
  let previousNamespace: string;

  beforeEach(() => {
    previousBackend = getBackendSrv();
    previousNamespace = config.namespace;
    config.namespace = 'stacks-1';
    fetch.mockReset().mockReturnValue(of({ data: { status: 'OK', message: 'healthy' } }));
    setBackendSrv({ fetch } as unknown as BackendSrv);
    setTestFlags({
      [resourceFlag]: true,
      [healthFlag]: true,
      [allowedTypesFlag]: { resources: ['prometheus'], health: ['prometheus'] },
    });
  });

  afterEach(() => {
    setTestFlags({});
    setBackendSrv(previousBackend);
    config.namespace = previousNamespace;
  });

  it('keeps Pinot GET, POST and health calls on legacy APIs when both rollout flags are enabled', async () => {
    const ds = datasource('startree-pinot-datasource');
    await ds.getResource('tables');
    await ds.postResource('tables', { name: 'example' });
    await ds.callHealthCheck();

    expect(fetch.mock.calls.map(([request]) => [request.method, request.url])).toEqual([
      ['GET', '/api/datasources/uid/pinot-uid/resources/tables'],
      ['POST', '/api/datasources/uid/pinot-uid/resources/tables'],
      ['GET', '/api/datasources/uid/pinot-uid/health'],
    ]);
  });

  it('uses new resource and health APIs for an allowed plugin', async () => {
    const ds = datasource('prometheus');
    await ds.getResource('api/v1/labels');
    await ds.callHealthCheck();

    expect(fetch.mock.calls.map(([request]) => request.url)).toEqual([
      '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/pinot-uid/resources/api/v1/labels',
      '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/pinot-uid/health',
    ]);
  });

  it.each([
    ['missing', undefined],
    ['empty', { resources: [], health: [] }],
    ['malformed lists', { resources: 'prometheus', health: null }],
    ['a scalar', 'prometheus'],
    ['an array', ['prometheus']],
  ])('uses legacy APIs when the capability configuration is %s', async (_, allowedTypes) => {
    setTestFlags({
      [resourceFlag]: true,
      [healthFlag]: true,
      ...(allowedTypes === undefined ? {} : { [allowedTypesFlag]: allowedTypes }),
    });
    const ds = datasource('prometheus');
    expect(ds.buildResourcesDatasourceUrl('tables')).toBe('/api/datasources/uid/pinot-uid/resources/tables');
    await ds.callHealthCheck();
    expect(fetch.mock.calls[0][0].url).toBe('/api/datasources/uid/pinot-uid/health');
  });

  it.each(['resources', 'health'] as const)('checks the %s capability independently', async (endpoint) => {
    setTestFlags({
      [resourceFlag]: true,
      [healthFlag]: true,
      [allowedTypesFlag]: { [endpoint]: ['prometheus'] },
    });
    const ds = datasource('prometheus');
    expect(ds.buildResourcesDatasourceUrl('tables')).toBe(
      endpoint === 'resources'
        ? '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/pinot-uid/resources/tables'
        : '/api/datasources/uid/pinot-uid/resources/tables'
    );
    await ds.callHealthCheck();
    expect(fetch.mock.calls[0][0].url).toBe(
      endpoint === 'health'
        ? '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/pinot-uid/health'
        : '/api/datasources/uid/pinot-uid/health'
    );
  });

  it('honors disabled rollout flags even for allowed plugins', async () => {
    setTestFlags({ [allowedTypesFlag]: { resources: ['prometheus'], health: ['prometheus'] } });
    const ds = datasource('prometheus');
    expect(ds.buildResourcesDatasourceUrl('tables')).toBe('/api/datasources/uid/pinot-uid/resources/tables');
    await ds.callHealthCheck();
    expect(fetch.mock.calls[0][0].url).toBe('/api/datasources/uid/pinot-uid/health');
  });

  it('checks the same canonical plugin ID used to build the API URL', async () => {
    const ds = datasource('prometheus', { id: 'startree-pinot-datasource' } as DataSourcePluginMeta);
    expect(ds.buildResourcesDatasourceUrl('tables')).toBe('/api/datasources/uid/pinot-uid/resources/tables');
    await ds.callHealthCheck();
    expect(fetch.mock.calls[0][0].url).toBe('/api/datasources/uid/pinot-uid/health');
    expect(
      datasource('alias', { id: 'prometheus' } as DataSourcePluginMeta).buildResourcesDatasourceUrl('tables')
    ).toBe(
      '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources/pinot-uid/resources/tables'
    );
  });
});
