import { relativeTemplateUrlToCDN } from './plugin_component';

describe('Plugin Component', () => {
  describe('relativeTemplateUrlToCDN()', () => {
    it('should create a proper path', () => {
      const templateUrl = 'partials/module.html';
      const baseUrl = 'plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel';
      const expectedUrl =
        'http://grafana-assets-staging.grafana.net.global.prod.fastly.net/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/partials/module.html';

      expect(relativeTemplateUrlToCDN(templateUrl, baseUrl)).toBe(expectedUrl);
    });
  });
});
