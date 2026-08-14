import { PluginLoadingStrategy } from '@grafana/data';

import {
  registerPluginInfoInCache,
  clearPluginInfoInCache,
  resolvePluginUrlWithCache,
  getPluginInfoFromCache,
  extractCacheKeyFromPath,
} from './pluginInfoCache';

jest.mock('./constants', () => ({
  ...jest.requireActual('./constants'),
  CACHE_INITIALISED_AT: 123456,
}));

describe('Cache Functions', () => {
  describe('registerPluginInfoInCache', () => {
    it('should register pluginInfo in the cache', () => {
      const plugin = { version: '1.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache({ path: 'public/plugins/plugin1/module.js', ...plugin });
      expect(getPluginInfoFromCache('plugin1')).toEqual(plugin);
    });

    it('should not register pluginInfo if it already exists in the cache', () => {
      const path = 'public/plugins/plugin2/module.js';
      const plugin = { path, version: '2.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache(plugin);
      const plugin2 = { path, version: '2.5.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache(plugin2);
      expect(getPluginInfoFromCache(path)?.version).toBe('2.0.0');
    });
  });

  describe('clearPluginInfoInCache', () => {
    it('should clear pluginInfo in the cache', () => {
      const path = 'public/plugins/plugin2/module.js';
      const plugin = { path, version: '3.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache(plugin);
      clearPluginInfoInCache('plugin2');
      expect(getPluginInfoFromCache('plugin2')).toBeUndefined();
    });

    it('should not throw an error if the pluginInfo does not exist in the cache', () => {
      expect(() => clearPluginInfoInCache('nonExistentPlugin')).not.toThrow();
    });
  });

  describe('resolvePluginUrlWithCache', () => {
    it('should resolve URL with timestamp cache bust parameter if pluginInfo is not available in the cache', () => {
      const url = 'http://localhost:3000/public/plugins/plugin4/module.js';
      expect(resolvePluginUrlWithCache(url)).toContain('_cache=123456');
    });

    it('should resolve URL with plugin version as cache bust parameter if available', () => {
      const url = 'http://localhost:3000/public/plugins/plugin5/module.js';
      const plugin = { path: url, version: '5.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache(plugin);
      expect(resolvePluginUrlWithCache(url)).toContain('_cache=5.0.0');
    });
  });

  describe('extractCacheKeyFromPath', () => {
    it('should extract plugin ID from a path', () => {
      expect(extractCacheKeyFromPath('public/plugins/plugin6/module.js')).toBe('plugin6');
    });

    it('should extract plugin ID from a path', () => {
      expect(extractCacheKeyFromPath('public/plugins/plugin6/datasource/module.js')).toBe('plugin6');
    });

    it('should extract plugin ID from a url', () => {
      expect(extractCacheKeyFromPath('https://my-url.com/plugin6/1.0.0/public/plugins/plugin6/module.js')).toBe(
        'plugin6'
      );
    });

    it('should extract plugin ID from a nested plugin url', () => {
      expect(
        extractCacheKeyFromPath('https://my-url.com/plugin6/1.0.0/public/plugins/plugin6/datasource/module.js')
      ).toBe('plugin6');
    });

    it('should return null if the path does not match the pattern', () => {
      expect(extractCacheKeyFromPath('public/plugins/plugin7')).toBeNull();
    });
  });

  describe('getPluginInfoFromCache', () => {
    it('should return pluginInfo from cache if exists', () => {
      const plugin = { version: '6.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInfoInCache({ path: 'public/plugins/plugin6/module.js', ...plugin });
      expect(getPluginInfoFromCache('plugin6')).toEqual(plugin);
    });

    it('should return undefined if pluginInfo does not exist in cache', () => {
      expect(getPluginInfoFromCache('nonExistentPlugin')).toBeUndefined();
    });
  });
});
