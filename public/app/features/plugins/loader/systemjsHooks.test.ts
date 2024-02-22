// mock fetch for SystemJS
import 'whatwg-fetch';

import { SystemJS, config } from '@grafana/runtime';

jest.mock('./cache', () => ({
  resolveWithCache: (url: string) => `${url}?_cache=1234`,
}));

import { server } from './pluginLoader.mock';
import { decorateSystemJSFetch, decorateSystemJSResolve } from './systemjsHooks';
import { SystemJSWithLoaderHooks } from './types';

describe('SystemJS Loader Hooks', () => {
  const systemJSPrototype: SystemJSWithLoaderHooks = SystemJS.constructor.prototype;
  const originalFetch = systemJSPrototype.fetch;
  const originalResolve = systemJSPrototype.resolve;

  beforeAll(() => {
    server.listen();
    systemJSPrototype.resolve = (moduleId: string) => moduleId;
    systemJSPrototype.shouldFetch = () => true;
    // because server.listen() patches fetch, we need to reassign this to the systemJSPrototype
    // this is identical to what happens in the original code: https://github.com/systemjs/systemjs/blob/main/src/features/fetch-load.js#L12
    systemJSPrototype.fetch = window.fetch;
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    SystemJS.constructor.prototype.resolve = originalResolve;
    SystemJS.constructor.prototype.fetch = originalFetch;
    server.close();
  });

  describe('decorateSystemJSFetch', () => {
    it('only transforms plugin source code hosted on cdn with cdn paths', async () => {
      config.pluginsCDNBaseURL = 'http://my-cdn.com/plugins';
      const cdnUrl = 'http://my-cdn.com/plugins/my-plugin/v1.0.0/public/plugins/my-plugin/module.js';
      const cdnResult = await decorateSystemJSFetch(systemJSPrototype.fetch, cdnUrl, {});
      const cdnSource = await cdnResult.text();

      expect(cdnSource).toContain('var pluginPath = "http://my-cdn.com/plugins/my-plugin/v1.0.0/public/plugins/";');

      const url = '/public/plugins/mockAmdModule/module.js';
      const result = await decorateSystemJSFetch(systemJSPrototype.fetch, url, {});
      const source = await result.text();
      expect(source).toContain('var pluginPath = "/public/plugins/";');
    });
  });
  describe('decorateSystemJSResolve', () => {
    it('removes legacy wildcard from resolved url', () => {
      const id = '/public/plugins/my-datasource/styles.css!';
      const result = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id);

      expect(result).toBe('http://localhost/public/plugins/my-datasource/styles.css');
    });
    it('adds default js extension to resolved url', () => {
      // test against missing extension
      const id = '/public/plugins/my-plugin/traffic_light';
      const result = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id);

      expect(result).toBe('http://localhost/public/plugins/my-plugin/traffic_light.js');

      // test against missing extension with periods in filename
      const id2 = '/public/plugins/my-plugin/lib/flot/jquery.flot.gauge';
      const result2 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id2);

      expect(result2).toBe('http://localhost/public/plugins/my-plugin/lib/flot/jquery.flot.gauge.js');

      // test against bare specifiers
      const id3 = 'package:lodash';
      const result3 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id3);

      expect(result3).toBe('package:lodash');

      // test against file extensions systemjs can load
      const id4 = '/public/plugins/my-plugin/traffic_light.js';
      const result4 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id4);

      expect(result4).toBe('http://localhost/public/plugins/my-plugin/traffic_light.js');

      const id5 = '/public/plugins/my-plugin/traffic_light.css';
      const result5 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id5);

      expect(result5).toBe('http://localhost/public/plugins/my-plugin/traffic_light.css');

      const id6 = '/public/plugins/my-plugin/traffic_light.json';
      const result6 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id6);

      expect(result6).toBe('http://localhost/public/plugins/my-plugin/traffic_light.json');

      const id7 = '/public/plugins/my-plugin/traffic_light.wasm';
      const result7 = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id7);

      expect(result7).toBe('http://localhost/public/plugins/my-plugin/traffic_light.wasm');
    });
    it('resolves loadPluginCSS urls correctly', () => {
      const id = 'plugins/my-plugin/dark.css';
      const result = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id);

      expect(result).toBe('/public/plugins/my-plugin/dark.css');
    });
    it('adds cache query param to resolved module.js url', () => {
      const id = '/public/plugins/my-plugin/module.js';
      const result = decorateSystemJSResolve.bind(systemJSPrototype)(originalResolve, id);

      expect(result).toBe('http://localhost/public/plugins/my-plugin/module.js?_cache=1234');
    });
  });
});
