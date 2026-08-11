import { PluginLoadingStrategy } from '@grafana/data';

import {
  registerPluginInfoInCache,
  clearPluginInfoInCache,
  resolvePluginUrlWithCache,
  resolvePluginUrlWithBuildHash,
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

  describe('resolvePluginUrlWithBuildHash', () => {
    it('pins the URL to the build-addressed route when a buildHash is registered', () => {
      const url = 'http://localhost:3000/public/plugins/build-plugin/module.js';
      registerPluginInfoInCache({
        path: url,
        version: '1.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'abc123hash',
      });

      const result = resolvePluginUrlWithBuildHash(url);

      // build-addressed route: /public/plugins/:id/:buildHash/*
      expect(result).toBe('http://localhost:3000/public/plugins/build-plugin/abc123hash/module.js');
      // must NOT carry a timestamp cache-bust param
      expect(result).not.toContain('_cache=');
    });

    it('pins nested chunk URLs to the build-addressed route', () => {
      const url = 'http://localhost:3000/public/plugins/nested-plugin/module.js';
      registerPluginInfoInCache({
        path: url,
        version: '2.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'deadbeef',
      });

      const chunkUrl = 'http://localhost:3000/public/plugins/nested-plugin/lib/chunk.123.js';
      const result = resolvePluginUrlWithBuildHash(chunkUrl);

      expect(result).toBe('http://localhost:3000/public/plugins/nested-plugin/deadbeef/lib/chunk.123.js');
      expect(result).not.toContain('_cache=');
    });

    it('uses the same buildHash consistently across multiple requests for the same plugin', () => {
      const moduleUrl = 'http://localhost:3000/public/plugins/session-plugin/module.js';
      registerPluginInfoInCache({
        path: moduleUrl,
        version: '3.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'sessionhash',
      });

      const first = resolvePluginUrlWithBuildHash(moduleUrl);
      const second = resolvePluginUrlWithBuildHash(
        'http://localhost:3000/public/plugins/session-plugin/lib/other.js'
      );

      expect(first).toContain('/session-plugin/sessionhash/');
      expect(second).toContain('/session-plugin/sessionhash/');
    });

    it('pins the URL when only a buildHash is registered (no info.version)', () => {
      const url = 'http://localhost:3000/public/plugins/versionless-plugin/module.js';
      registerPluginInfoInCache({
        path: url,
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'noversionhash',
      });

      const result = resolvePluginUrlWithBuildHash(url);

      expect(result).toBe('http://localhost:3000/public/plugins/versionless-plugin/noversionhash/module.js');
      expect(result).not.toContain('_cache=');
    });

    it('falls back to timestamp cache-busting when no buildHash is available (mixed-version safety)', () => {
      const url = 'http://localhost:3000/public/plugins/no-hash-plugin/module.js';
      // registered without a buildHash
      registerPluginInfoInCache({
        path: url,
        version: '4.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
      });

      const result = resolvePluginUrlWithBuildHash(url);

      expect(result).toContain('_cache=');
      expect(result).not.toContain('/4.0.0/module.js');
    });

    it('falls back to cache-busting for a decoupled core plugin URL that cannot be build-addressed', () => {
      // Registered under the decoupled path (/public/app/plugins/panel/:id/) with a
      // buildHash, but the request URL is not a /public/plugins/ asset so the hash cannot
      // be inserted. It must still receive cache-busting, not be returned unbusted.
      const registeredPath = 'public/app/plugins/panel/decoupled-panel/module.js';
      registerPluginInfoInCache({
        path: registeredPath,
        version: '9.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'decoupledhash',
      });

      const url = 'http://localhost:3000/public/app/plugins/panel/decoupled-panel/module.js';
      const result = resolvePluginUrlWithBuildHash(url);

      expect(result).toContain('_cache=');
      expect(result).not.toContain('/decoupledhash/');
    });

    it('resolves the correct plugin by ID, not a substring/prefix match', () => {
      registerPluginInfoInCache({
        path: 'public/plugins/col/module.js',
        version: '1.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'colhash',
      });
      registerPluginInfoInCache({
        path: 'public/plugins/col-panel/module.js',
        version: '1.0.0',
        loadingStrategy: PluginLoadingStrategy.script,
        buildHash: 'colpanelhash',
      });

      const url = 'http://localhost:3000/public/plugins/col-panel/module.js';
      const result = resolvePluginUrlWithBuildHash(url);

      // Must pin with col-panel's hash — not "col" (a prefix of "col-panel").
      expect(result).toBe('http://localhost:3000/public/plugins/col-panel/colpanelhash/module.js');
    });

    it('falls back to timestamp cache-busting when the plugin is unknown', () => {
      const url = 'http://localhost:3000/public/plugins/unregistered-plugin/module.js';
      const result = resolvePluginUrlWithBuildHash(url);

      expect(result).toContain('_cache=123456');
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
