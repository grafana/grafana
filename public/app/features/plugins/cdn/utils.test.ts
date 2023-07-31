import { transformPluginSourceForCDN } from './utils';

describe('Plugin CDN Utils', () => {
  const url = 'http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js';

  describe('transformPluginSourceForCdn', () => {
    it('should update the default local path to use the CDN path', () => {
      const translatedLoad = transformPluginSourceForCDN({
        url,
        source: 'public/plugins/grafana-worldmap-panel/template.html',
      });
      expect(translatedLoad).toBe(
        'http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html'
      );
    });

    it('should replace the default path in a multi-line source code', () => {
      const source = `
        const a = "public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const expectedSource = `
        const a = "http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const translatedLoad = transformPluginSourceForCDN({ url, source });
      expect(translatedLoad).toBe(expectedSource);
    });

    it('should cater for local paths starting with a slash', () => {
      const source = `
        const a = "/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const expectedSource = `
        const a = "http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/template.html";
        const img = "<img src='http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/myimage.jpg'>";
      `;
      const translatedLoad = transformPluginSourceForCDN({ url, source });
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
          "http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/data/" +
            this.panel.locationData +
            ".json"
        )
      `;
      const translatedLoad = transformPluginSourceForCDN({ url, source });

      expect(translatedLoad).toBe(expectedSource);
    });

    it('should only replace sourcemap locations if transformSourceMapUrl is true', () => {
      const source = `
        Zn(t,e)},t.Rectangle=ui,t.rectangle=function(t,e){return new ui(t,e)},t.Map=He,t.map=function(t,e){return new He(t,e)}}(e)}])});
        //# sourceMappingURL=module.js.map
      `;
      const expectedSource = `
        Zn(t,e)},t.Rectangle=ui,t.rectangle=function(t,e){return new ui(t,e)},t.Map=He,t.map=function(t,e){return new He(t,e)}}(e)}])});
        //# sourceMappingURL=http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js.map
      `;
      const translatedLoad = transformPluginSourceForCDN({ url, source });

      expect(translatedLoad).toBe(source);

      const translatedLoadWithSourceMapUrl = transformPluginSourceForCDN({ url, source, transformSourceMapURL: true });

      expect(translatedLoadWithSourceMapUrl).toBe(expectedSource);
    });

    it('should replace css paths', () => {
      const source = `(0,o.loadPluginCss)({dark:"plugins/grafana-worldmap-panel/css/worldmap.dark.css",light:"plugins/grafana-worldmap-panel/css/worldmap.light.css"}),`;
      const expectedSource = `(0,o.loadPluginCss)({dark:"http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/css/worldmap.dark.css",light:"http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/css/worldmap.light.css"}),`;
      const translatedLoad = transformPluginSourceForCDN({ url, source });

      expect(translatedLoad).toBe(expectedSource);
    });
  });
});
