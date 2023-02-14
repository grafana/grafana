import { getPluginExtensions } from './extensions';
import { setPluginsExtensionRegistry } from './registry';

describe('getPluginExtensions', () => {
  describe('when getting extensions for placement', () => {
    const placement = 'grafana/dashboard/panel/menu';
    const pluginId = 'grafana-basic-app';

    beforeAll(() => {
      setPluginsExtensionRegistry({
        [placement]: [
          {
            type: 'link',
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 1,
          },
        ],
        'plugins/myorg-basic-app/start': [
          {
            type: 'link',
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 2,
          },
        ],
      });
    });

    it('should return extensions with correct path', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      expect(extension.path).toBe(`/a/${pluginId}/declare-incident`);
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct description', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      expect(extension.description).toBe('Declaring an incident in the app');
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct title', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      expect(extension.title).toBe('Declare incident');
      expect(extensions.length).toBe(1);
    });

    it('should return an empty array when extensions can be found', () => {
      const { extensions } = getPluginExtensions({
        placement: 'plugins/not-installed-app/news',
      });

      expect(extensions.length).toBe(0);
    });
  });
});
