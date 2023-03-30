import { assertPluginExtensionLink, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';

import { getPluginExtensions } from './extensions';
import { PluginExtensionRegistryItem, setPluginsExtensionRegistry } from './registry';

describe('getPluginExtensions', () => {
  describe('when getting extensions for placement', () => {
    const placement = 'grafana/dashboard/panel/menu';
    const pluginId = 'grafana-basic-app';

    beforeAll(() => {
      setPluginsExtensionRegistry({
        [placement]: [
          createRegistryLinkItem({
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 1,
          }),
        ],
        'plugins/myorg-basic-app/start': [
          createRegistryLinkItem({
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 2,
          }),
        ],
      });
    });

    it('should return extensions with correct path', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

      expect(extension.path).toBe(`/a/${pluginId}/declare-incident`);
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct description', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

      expect(extension.description).toBe('Declaring an incident in the app');
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct title', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

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

function createRegistryLinkItem(
  link: Omit<PluginExtensionLink, 'type'>
): PluginExtensionRegistryItem<PluginExtensionLink> {
  return (context?: object) => ({
    ...link,
    type: PluginExtensionTypes.link,
  });
}
