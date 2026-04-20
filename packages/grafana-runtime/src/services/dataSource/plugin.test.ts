import { type DataSourceInstanceSettings, type DataSourcePluginMeta, DataSourcePlugin } from '@grafana/data';

import { invalidateCache } from '../../utils/getCachedPromise';
import { RuntimeDataSource } from '../RuntimeDataSource';

import { _resetForTests as resetInstanceSettings, init } from './instanceSettings';
import {
  _resetForTests as resetPlugin,
  getDataSourcePlugin,
  registerRuntimeDataSource,
  setDataSourcePluginImporter,
} from './plugin';

class TestDataSourceApi {
  name: string;
  id: number | undefined;
  type: string;
  uid: string;
  meta: DataSourcePluginMeta;

  constructor(public instanceSettings: DataSourceInstanceSettings) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.type = instanceSettings.type;
    this.uid = instanceSettings.uid;
    this.meta = instanceSettings.meta;
  }
}

class TestRuntime extends RuntimeDataSource {
  query() {
    return Promise.resolve({ data: [] });
  }
}

function ds(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'uid',
    name: 'name',
    type: 'test-db',
    access: 'direct',
    jsonData: {},
    readOnly: false,
    meta: {
      id: 'test-db',
      name: 'Test DB',
      type: 'datasource',
      module: '',
      baseUrl: '',
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { small: '', large: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
      metrics: true,
    },
    ...overrides,
  } as DataSourceInstanceSettings;
}

const fixtures: Record<string, DataSourceInstanceSettings> = {
  Alpha: ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', type: 'test-db' }),
};

beforeEach(() => {
  resetInstanceSettings();
  resetPlugin();
  invalidateCache();
});

describe('plugin', () => {
  describe('getDataSourcePlugin', () => {
    it('loads and caches a plugin instance', async () => {
      init(fixtures, 'Alpha');
      const importDataSource = jest.fn().mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new DataSourcePlugin(TestDataSourceApi as any)
      );
      setDataSourcePluginImporter({ importDataSource });

      const instance = await getDataSourcePlugin('uid-alpha');
      const cached = await getDataSourcePlugin('uid-alpha');

      expect(instance).toBe(cached);
      expect(importDataSource).toHaveBeenCalledTimes(1);
    });

    it('throws when the data source is not found', async () => {
      init(fixtures, 'Alpha');
      setDataSourcePluginImporter({ importDataSource: jest.fn() });

      await expect(getDataSourcePlugin('missing')).rejects.toThrow(/was not found/);
    });

    it('throws if the importer has not been registered', async () => {
      init(fixtures, 'Alpha');
      await expect(getDataSourcePlugin('uid-alpha')).rejects.toThrow(/DataSourcePluginImporter has not been set/);
    });
  });

  describe('registerRuntimeDataSource', () => {
    it('makes the runtime data source available to getDataSourcePlugin', async () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      const result = await getDataSourcePlugin('runtime-uid');
      expect(result).toBe(runtime);
    });

    it('throws on duplicate uid', () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });
      const duplicate = new TestRuntime('plugin-id', 'runtime-uid');
      expect(() => registerRuntimeDataSource({ dataSource: duplicate })).toThrow(/already been registered/);
    });
  });
});
