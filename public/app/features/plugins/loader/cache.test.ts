import { registerPluginInCache, invalidatePluginInCache, resolveWithCache, getPluginFromCache } from './cache';

jest.mock('./constants', () => ({
  CACHE_INITIALISED_AT: 123456,
}));

describe('Cache Functions', () => {
  describe('registerPluginInCache', () => {
    it('should register a plugin in the cache', () => {
      const plugin = { pluginId: 'plugin1', version: '1.0.0', isAngular: false };
      registerPluginInCache(plugin);
      expect(getPluginFromCache('plugin1')).toEqual(plugin);
    });

    it('should not register a plugin if it already exists in the cache', () => {
      const pluginId = 'plugin2';
      const plugin = { pluginId, version: '2.0.0' };
      registerPluginInCache(plugin);
      const plugin2 = { pluginId, version: '2.5.0' };
      registerPluginInCache(plugin2);
      expect(getPluginFromCache(pluginId)?.version).toBe('2.0.0');
    });
  });

  describe('invalidatePluginInCache', () => {
    it('should invalidate a plugin in the cache', () => {
      const pluginId = 'plugin3';
      const plugin = { pluginId, version: '3.0.0' };
      registerPluginInCache(plugin);
      invalidatePluginInCache(pluginId);
      expect(getPluginFromCache(pluginId)).toBeUndefined();
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
      const plugin = { pluginId: 'plugin5', version: '5.0.0' };
      registerPluginInCache(plugin);
      const url = 'http://localhost:3000/public/plugins/plugin5/module.js';
      expect(resolveWithCache(url)).toContain('_cache=5.0.0');
    });
  });

  describe('getPluginFromCache', () => {
    it('should return plugin from cache if exists', () => {
      const plugin = { pluginId: 'plugin6', version: '6.0.0' };
      registerPluginInCache(plugin);
      expect(getPluginFromCache('plugin6')).toEqual(plugin);
    });

    it('should return undefined if plugin does not exist in cache', () => {
      expect(getPluginFromCache('nonExistentPlugin')).toBeUndefined();
    });
  });
});
