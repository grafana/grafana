import * as pluginSettings from '../pluginSettings';

import { invalidatePluginInCache, locateWithCache, registerPluginInCache } from './pluginCacheBuster';

describe('PluginCacheBuster', () => {
  const now = 12345;

  it('should append plugin version as cache flag if plugin is registered in buster', () => {
    const slug = 'bubble-chart-1';
    const version = 'v1.0.0';
    const path = resolvePath(slug);
    const address = `http://localhost:3000/public/${path}.js`;

    registerPluginInCache({ path, version });

    const url = `${address}?_cache=${encodeURI(version)}`;
    expect(locateWithCache({ address }, now)).toBe(url);
  });

  it('should append Date.now as cache flag if plugin is not registered in buster', () => {
    const slug = 'bubble-chart-2';
    const address = `http://localhost:3000/public/${resolvePath(slug)}.js`;

    const url = `${address}?_cache=${encodeURI(String(now))}`;
    expect(locateWithCache({ address }, now)).toBe(url);
  });

  it('should append Date.now as cache flag if plugin is invalidated in buster', () => {
    const slug = 'bubble-chart-3';
    const version = 'v1.0.0';
    const path = resolvePath(slug);
    const address = `http://localhost:3000/public/${path}.js`;

    registerPluginInCache({ path, version });
    invalidatePluginInCache(slug);

    const url = `${address}?_cache=${encodeURI(String(now))}`;
    expect(locateWithCache({ address }, now)).toBe(url);
  });

  it('should also clear plugin settings cache', () => {
    const slug = 'bubble-chart-3';
    const version = 'v1.0.0';
    const path = resolvePath(slug);

    const clearPluginSettingsCacheSpy = jest.spyOn(pluginSettings, 'clearPluginSettingsCache');

    registerPluginInCache({ path, version });
    invalidatePluginInCache(slug);

    expect(clearPluginSettingsCacheSpy).toBeCalledTimes(1);
    expect(clearPluginSettingsCacheSpy).toBeCalledWith('bubble-chart-3');
  });
});

function resolvePath(slug: string): string {
  return `plugins/${slug}/module`;
}
