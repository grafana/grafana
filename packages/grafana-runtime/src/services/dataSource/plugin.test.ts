import { type DataSourceApi } from '@grafana/data';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { RuntimeDataSource } from '../RuntimeDataSource';

import { _resetForTests as resetInstanceSettings, init } from './instanceSettings';
import {
  _resetForTests as resetPlugin,
  getDataSourcePlugin,
  getRuntimeDataSourcePlugin,
  registerRuntimeDataSource,
  setGetDataSourcePlugin,
} from './plugin';

class TestRuntime extends RuntimeDataSource {
  query() {
    return Promise.resolve({ data: [] });
  }
}

beforeEach(() => {
  resetInstanceSettings();
  resetPlugin();
  invalidateCachedPromisesCache();
});

describe('plugin', () => {
  describe('getDataSourcePlugin', () => {
    it('delegates to the injected implementation', async () => {
      const mockImpl = jest.fn().mockResolvedValue({ name: 'mock-ds' } as unknown as DataSourceApi);
      setGetDataSourcePlugin(mockImpl);

      const result = await getDataSourcePlugin('uid-alpha');

      expect(mockImpl).toHaveBeenCalledWith('uid-alpha', undefined);
      expect(result).toEqual({ name: 'mock-ds' });
    });

    it('throws if not initialized', async () => {
      await expect(getDataSourcePlugin('uid-alpha')).rejects.toThrow(/has not been initialized/);
    });
  });

  describe('registerRuntimeDataSource', () => {
    it('makes the runtime instance available via getRuntimeDataSourcePlugin', () => {
      init({}, '');
      const runtime = new TestRuntime('plugin-id', 'runtime-uid');
      registerRuntimeDataSource({ dataSource: runtime });

      expect(getRuntimeDataSourcePlugin('runtime-uid')).toBe(runtime);
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
