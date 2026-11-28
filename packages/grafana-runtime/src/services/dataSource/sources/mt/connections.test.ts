import { type DataSourcePluginMeta } from '@grafana/data';

import { invalidateCachedPromisesCache } from '../../../../utils/getCachedPromise';
import { type BackendSrv, setBackendSrv } from '../../../backendSrv';
import { setDatasourcePluginMetas } from '../../../pluginMeta/datasources';

import { getDataSourceConnections } from './connections';
import { type DataSourceConnection } from './types';

const CONNECTIONS_URL = 'apis/query.grafana.app/v0alpha1/namespaces/default/connections';

const prometheus = { id: 'prometheus', name: 'Prometheus', type: 'datasource' } as DataSourcePluginMeta;

function connection(name: string, plugin: string): DataSourceConnection {
  return { title: name, name, group: `${plugin}.datasource.grafana.app`, plugin };
}

const backendGet = jest.fn();

beforeEach(() => {
  invalidateCachedPromisesCache();
  backendGet.mockReset();
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
  setDatasourcePluginMetas({ prometheus });
});

describe('getDataSourceConnections', () => {
  it('returns every connection across pages, orphans included', async () => {
    backendGet.mockImplementation(async (_url: string, params?: { continue?: string }) =>
      params?.continue
        ? { items: [connection('uid-orphan', 'not-installed')] }
        : { items: [connection('uid-prom', 'prometheus')], metadata: { continue: 'v1_1' } }
    );

    const result = await getDataSourceConnections();

    expect(backendGet).toHaveBeenCalledWith(CONNECTIONS_URL, undefined, undefined, { showErrorAlert: false });
    expect(result).toEqual([
      {
        uid: 'uid-prom',
        name: 'uid-prom',
        type: 'prometheus',
        isDefault: false,
        meta: prometheus,
      },
      {
        uid: 'uid-orphan',
        name: 'uid-orphan',
        type: 'not-installed',
        isDefault: false,
      },
    ]);
  });

  it('rejects when the connections request fails', async () => {
    backendGet.mockRejectedValue(new Error('boom'));

    await expect(getDataSourceConnections()).rejects.toThrow('boom');
  });
});
