import { translateForCDN, extractPluginDeets } from './pluginCDN';

describe('Plugin CDN', () => {
  describe('translateForCDN', () => {
    const load = {
      name: 'http://localhost:3000/public/plugin-cdn/grafana-worldmap-panel/0.3.3/grafana-worldmap-panel/module.js',
      address:
        'http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/grafana-worldmap-panel/module.js',
      source: 'public/plugins/grafana-worldmap-panel/template.html',
      metadata: {
        extension: '',
        deps: [],
        format: 'amd',
        loader: 'cdn-loader',
        encapsulateGlobal: false,
        cjsRequireDetection: true,
        cjsDeferDepsExecute: false,
        esModule: true,
        authorization: false,
      },
    };

    it('should update the default local path to use the CDN path', () => {
      const translatedLoad = translateForCDN({
        ...load,
        source: 'public/plugins/grafana-worldmap-panel/template.html',
      });
      expect(translatedLoad).toBe(
        'http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html'
      );
    });

    it('should replace the default path in a multi-line source code', () => {
      const source = `
        const a = "public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const expectedSource = `
        const a = "http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const translatedLoad = translateForCDN({ ...load, source });
      expect(translatedLoad).toBe(expectedSource);
    });

    it('should cater for local paths starting with a slash', () => {
      const source = `
        const a = "/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const expectedSource = `
        const a = "http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const translatedLoad = translateForCDN({ ...load, source });
      expect(translatedLoad).toBe(expectedSource);
    });

    it('should cater for a particular path', () => {
      const source = `
        .getJSON(
          "public/plugins/grafana-worldmap-panel/data/" +
            this.panel.locationData +
            ".json"
        )
      `;
      const expectedSource = `
        .getJSON(
          "http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/" +
            this.panel.locationData +
            ".json"
        )
      `;
      const translatedLoad = translateForCDN({ ...load, source });
      expect(translatedLoad).toBe(expectedSource);
    });

    it('should replace sourcemap locations', () => {
      const source = `
        Zn(t,e)},t.Rectangle=ui,t.rectangle=function(t,e){return new ui(t,e)},t.Map=He,t.map=function(t,e){return new He(t,e)}}(e)}])});
        //# sourceMappingURL=module.js.map
      `;
      const expectedSource = `
        Zn(t,e)},t.Rectangle=ui,t.rectangle=function(t,e){return new ui(t,e)},t.Map=He,t.map=function(t,e){return new He(t,e)}}(e)}])});
        //# sourceMappingURL=http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js.map
      `;
      const translatedLoad = translateForCDN({ ...load, source });
      expect(translatedLoad).toBe(expectedSource);
    });
  });

  describe('extractPluginDeets', () => {
    it('should extract the plugin name and version from a path', () => {
      const source =
        'http://localhost:3000/public/plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js';
      const expected = {
        name: 'grafana-worldmap-panel',
        version: '0.3.3',
      };
      const expectedExtractedPluginDeets = extractPluginDeets(source);
      expect(expectedExtractedPluginDeets).toEqual(expected);
    });
  });
});
