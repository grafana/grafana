import { config } from '@grafana/runtime';

import { relativeTemplateUrlToCDN } from './plugin_component';

describe('Plugin Component', () => {
  describe('relativeTemplateUrlToCDN()', () => {
    it('should create a proper path', () => {
      config.pluginsCDNBaseURL = 'http://my-host.com';

      const templateUrl = 'partials/module.html';
      const baseUrl = 'plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel';
      const expectedUrl =
        'http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/partials/module.html';

      expect(relativeTemplateUrlToCDN(templateUrl, baseUrl)).toBe(expectedUrl);
    });
  });
});
