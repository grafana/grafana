import { lastValueFrom } from 'rxjs';

import {
  DataSourceApi,
  DataSourcePlugin,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
} from '@grafana/data';
import { getDataSourceInstance, setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import {
  setDataSourceInstanceSettings,
  setDataSourcePluginImporter,
  setDatasourcePluginMetas,
} from '@grafana/runtime/internal';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { MixedDatasource } from './MixedDataSource';

// Runs Mixed against the real DatasourceSrv and the real runtime instance API, so the two share
// one loader and one instance cache, as in the app.

class EchoDataSource extends DataSourceApi {
  query(request: DataQueryRequest): Promise<DataQueryResponse> {
    return Promise.resolve({ data: [`${this.name}:${request.targets.map((t) => t.refId).join(',')}`] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

const meta = (id: string, module = `public/plugins/${id}/module.js`) =>
  ({ id, module, metrics: true, info: {} }) as unknown as DataSourcePluginMeta;

const bootData = () =>
  ({
    Alpha: { id: 1, uid: 'uid-a', name: 'Alpha', type: 'a-db', meta: meta('a-db'), jsonData: {} },
    // The boot data meta points at a module that cannot load. The plugin meta has the working one.
    Charlie: { id: 3, uid: 'uid-c', name: 'Charlie', type: 'c-db', meta: meta('c-db', 'broken.js'), jsonData: {} },
  }) as unknown as Record<string, DataSourceInstanceSettings>;

// Mirrors pluginImporter: one promise per plugin id, and a rejected promise stays cached.
type ImportResult = ReturnType<Parameters<typeof setDataSourcePluginImporter>[0]>;
const importsById = new Map<string, ImportResult>();
const importer = jest.fn((pluginMeta: DataSourcePluginMeta): ImportResult => {
  let promise = importsById.get(pluginMeta.id);
  if (!promise) {
    promise =
      pluginMeta.module === 'broken.js'
        ? Promise.reject(new Error(`cannot load ${pluginMeta.module}`))
        : Promise.resolve(new DataSourcePlugin<DataSourceApi>(EchoDataSource));
    promise.catch(() => {});
    importsById.set(pluginMeta.id, promise);
  }
  return promise;
});

jest.mock('app/features/plugins/importer/pluginImporter', () => ({
  pluginImporter: { importDataSource: (pluginMeta: DataSourcePluginMeta) => importer(pluginMeta) },
}));

describe('MixedDatasource with the shared data source instance API', () => {
  let srv: DatasourceSrv;

  beforeEach(() => {
    importer.mockClear();
    importsById.clear();
    const templateSrv = new TemplateSrv();
    setTemplateSrv(templateSrv);
    setDataSourceInstanceSettings(bootData(), 'Alpha');
    setDatasourcePluginMetas({ 'a-db': meta('a-db'), 'c-db': meta('c-db') });
    setDataSourcePluginImporter(importer);
    srv = new DatasourceSrv(templateSrv);
    srv.init(bootData(), 'Alpha');
    setDataSourceSrv(srv);
  });

  it('imports the plugin from the plugin meta, not the boot data meta', async () => {
    // Before the loaders were shared, the runtime path imported "broken.js" first. That rejection
    // stayed in the importer cache, so the legacy fallback failed too and the panel had no data.
    const mixed = new MixedDatasource({} as DataSourceInstanceSettings);
    const request = {
      targets: [
        { refId: 'A', datasource: { uid: 'uid-a' } },
        { refId: 'C', datasource: { uid: 'uid-c' } },
      ],
    } as DataQueryRequest;

    await expect(mixed.query(request)).toEmitValuesWith((results) => {
      expect(results.map((r) => r.data)).toEqual([['Alpha:A'], ['Charlie:C']]);
    });
    expect(importer).not.toHaveBeenCalledWith(expect.objectContaining({ module: 'broken.js' }));
  });

  it('queries the same instance that DatasourceSrv.get() returns', async () => {
    const mixed = new MixedDatasource({} as DataSourceInstanceSettings);
    await lastValueFrom(mixed.query({ targets: [{ refId: 'A', datasource: { uid: 'uid-a' } }] } as DataQueryRequest));

    expect(await srv.get('uid-a')).toBe(await getDataSourceInstance('uid-a'));
    expect(importer).toHaveBeenCalledTimes(1);
  });
});
