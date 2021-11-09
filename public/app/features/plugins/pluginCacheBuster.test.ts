import { invalidatePluginInCache, locateWithCache, registerPluginInCache } from './pluginCacheBuster';

describe('PluginCacheBuster', () => {
  let spy: jest.SpyInstance;
  const now = Date.now();

  beforeAll(() => {
    spy = jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  it('should append plugin version as cache flag if plugin is registered in buster', () => {
    const slug = 'bubble-chart-1';
    const version = 'v1.0.0';
    const path = resolvePath(slug);
    const address = `http://localhost:3000/public/${path}.js`;

    registerPluginInCache({ path, version });

    const url = `${address}?_cache=${encodeURI(version)}`;
    expect(locateWithCache({ address })).toBe(url);
  });

  it('should append Date.now as cache flag if plugin is not registered in buster', () => {
    const slug = 'bubble-chart-2';
    const address = `http://localhost:3000/public/${resolvePath(slug)}.js`;

    const url = `${address}?_cache=${encodeURI(String(now))}`;
    expect(locateWithCache({ address })).toBe(url);
  });

  it('should append Date.now as cache flag if plugin is invalidated in buster', () => {
    const slug = 'bubble-chart-3';
    const version = 'v1.0.0';
    const path = resolvePath(slug);
    const address = `http://localhost:3000/public/${path}.js`;

    registerPluginInCache({ path, version });
    invalidatePluginInCache(slug);

    const url = `${address}?_cache=${encodeURI(String(now))}`;
    expect(locateWithCache({ address })).toBe(url);
  });

  afterAll(() => {
    spy.mockRestore();
  });
});

function resolvePath(slug: string): string {
  return `plugins/${slug}/module`;
}
