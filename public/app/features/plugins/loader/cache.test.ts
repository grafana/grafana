import { PluginLoadingStrategy } from '@grafana/data';

import {
  registerPluginInCache,
  invalidatePluginInCache,
  resolveWithCache,
  getPluginFromCache,
  extractCacheKeyFromPath,
} from './cache';

jest.mock('./constants', () => ({
  CACHE_INITIALISED_AT: 123456,
}));

describe('Cache Functions', () => {
  describe('registerPluginInCache', () => {
    it('should register a plugin in the cache', () => {
      const plugin = { version: '1.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache({ path: 'public/plugins/plugin1/module.js', ...plugin });
      expect(getPluginFromCache('plugin1')).toEqual(plugin);
    });

    it('should not register a plugin if it already exists in the cache', () => {
      const path = 'public/plugins/plugin2/module.js';
      const plugin = { path, version: '2.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache(plugin);
      const plugin2 = { path, version: '2.5.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache(plugin2);
      expect(getPluginFromCache(path)?.version).toBe('2.0.0');
    });
  });

  describe('invalidatePluginInCache', () => {
    it('should invalidate a plugin in the cache', () => {
      const path = 'public/plugins/plugin2/module.js';
      const plugin = { path, version: '3.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache(plugin);
      invalidatePluginInCache('plugin2');
      expect(getPluginFromCache('plugin2')).toBeUndefined();
    });

    it('should not throw an error if the plugin does not exist in the cache', () => {
      expect(() => invalidatePluginInCache('nonExistentPlugin')).not.toThrow();
    });
  });

  describe('resolveWithCache', () => {
    it('should resolve URL with timestamp cache bust parameter if plugin is not available in the cache', () => {
      const url = 'http://localhost:3000/public/plugins/plugin4/module.js';
      expect(resolveWithCache(url)).toContain('_cache=123456');
    });

    it('should resolve URL with plugin version as cache bust parameter if available', () => {
      const url = 'http://localhost:3000/public/plugins/plugin5/module.js';
      const plugin = { path: url, version: '5.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache(plugin);
      expect(resolveWithCache(url)).toContain('_cache=5.0.0');
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

  describe('getPluginFromCache', () => {
    it('should return plugin from cache if exists', () => {
      const plugin = { version: '6.0.0', loadingStrategy: PluginLoadingStrategy.script };
      registerPluginInCache({ path: 'public/plugins/plugin6/module.js', ...plugin });
      expect(getPluginFromCache('plugin6')).toEqual(plugin);
    });

    it('should return undefined if plugin does not exist in cache', () => {
      expect(getPluginFromCache('nonExistentPlugin')).toBeUndefined();
    });
  });
});
