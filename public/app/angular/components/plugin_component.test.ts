import * as constants from '../../features/plugins/systemjsPlugins/constants';

import { relativeTemplateUrlToCDN } from './plugin_component';

describe('Plugin Component', () => {
  beforeAll(() => {
    // ⚠️ Plugin cdn poc! ⚠️
    // TODO: this should be mocked from config.
    // @ts-ignore
    constants.cdnHost = 'http://my-host.com';
  });
  describe('relativeTemplateUrlToCDN()', () => {
    it('should create a proper path', () => {
      const templateUrl = 'partials/module.html';
      const baseUrl = 'plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel';
      const expectedUrl =
        'http://my-host.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/partials/module.html';

      expect(relativeTemplateUrlToCDN(templateUrl, baseUrl)).toBe(expectedUrl);
    });
  });
});
