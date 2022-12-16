import { relativeTemplateUrlToCDN } from './plugin_component';

describe('Plugin Component', () => {
  describe('relativeTemplateUrlToCDN()', () => {
    it('should create a proper path', () => {
      const templateUrl = 'partials/module.html';
      const baseUrl = 'plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel';
      const expectedUrl =
        'https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/partials/module.html';

      expect(relativeTemplateUrlToCDN(templateUrl, baseUrl)).toBe(expectedUrl);
    });
  });
});
