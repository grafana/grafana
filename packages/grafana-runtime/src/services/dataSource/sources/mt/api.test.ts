import { type DataSourcePluginMeta } from '@grafana/data';

import { config } from '../../../../config';
import { type BackendSrv, setBackendSrv } from '../../../backendSrv';

import { fetchConnectionsFromGroups } from './api';

const PROM_URL = 'apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources';
const LOKI_URL = 'apis/loki.datasource.grafana.app/v0alpha1/namespaces/default/datasources';

function meta(id: string, extra: Partial<DataSourcePluginMeta> = {}): DataSourcePluginMeta {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { id, name: id, type: 'datasource', ...extra } as DataSourcePluginMeta;
}

function resource(name: string, title: string, labels?: Record<string, string>) {
  return { metadata: { name, labels }, spec: { title } };
}

type Route = { status: number; body?: unknown };
let routes: Record<string, Route>;

const backendGet = jest.fn(async (url: string, params?: { continue?: string }): Promise<unknown> => {
  const route = routes[params?.continue ? `${url}?continue=${params.continue}` : url] ?? { status: 404 };
  if (route.status < 200 || route.status >= 300) {
    throw Object.assign(new Error('Error'), { status: route.status, statusText: 'Error', data: {} });
  }
  return route.body;
});

const options = { requestId: 'req', isCurrent: () => true };

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
});

beforeEach(() => {
  backendGet.mockClear();
  config.namespace = 'default';
  routes = {};
});

describe('fetchConnectionsFromGroups', () => {
  it('reads the group each installed plugin serves and merges the results', async () => {
    routes[PROM_URL] = { status: 200, body: { items: [resource('uid-prom', 'Prom', { default: 'true' })] } };
    routes[LOKI_URL] = { status: 200, body: { items: [resource('uid-loki', 'Loki')] } };

    const list = await fetchConnectionsFromGroups([meta('prometheus'), meta('loki')], options);

    expect(list?.items).toEqual([
      {
        title: 'Prom',
        name: 'uid-prom',
        group: 'prometheus.datasource.grafana.app',
        plugin: 'prometheus',
        labels: { default: 'true' },
      },
      {
        title: 'Loki',
        name: 'uid-loki',
        group: 'loki.datasource.grafana.app',
        plugin: 'loki',
        labels: undefined,
      },
    ]);
  });

  // A plugin can be installed without an API group being registered for it; that must not take the
  // whole list down with it.
  it('skips a group that is not served', async () => {
    routes[PROM_URL] = { status: 200, body: { items: [resource('uid-prom', 'Prom')] } };
    // No LOKI_URL route, so it answers 404.

    const list = await fetchConnectionsFromGroups([meta('prometheus'), meta('loki')], options);

    expect(list?.items.map((item) => item.name)).toEqual(['uid-prom']);
  });

  it('rejects when a group fails for any other reason', async () => {
    routes[PROM_URL] = { status: 500 };

    await expect(fetchConnectionsFromGroups([meta('prometheus')], options)).rejects.toMatchObject({ status: 500 });
  });

  it('follows the continue token within a group', async () => {
    routes[PROM_URL] = { status: 200, body: { items: [resource('uid-a', 'A')], metadata: { continue: 'p2' } } };
    routes[`${PROM_URL}?continue=p2`] = { status: 200, body: { items: [resource('uid-b', 'B')] } };

    const list = await fetchConnectionsFromGroups([meta('prometheus')], options);

    expect(list?.items.map((item) => item.name)).toEqual(['uid-a', 'uid-b']);
  });

  // The built-ins hold no instances; the mapper synthesizes them from the metas instead.
  it('does not query a group for a built-in data source', async () => {
    await fetchConnectionsFromGroups([meta('grafana', { builtIn: true })], options);

    expect(backendGet).not.toHaveBeenCalled();
  });

  it('resolves undefined once a newer fetch has replaced it', async () => {
    routes[PROM_URL] = { status: 200, body: { items: [] } };

    const list = await fetchConnectionsFromGroups([meta('prometheus')], { requestId: 'req', isCurrent: () => false });

    expect(list).toBeUndefined();
  });
});
