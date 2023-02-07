import { getPluginExtensions, PluginExtensionsMissingError } from './extensions';
import { setPluginsExtensionRegistry } from './registry';

describe('getPluginExtensions', () => {
  describe('when getting a registered extension link', () => {
    const pluginId = 'grafana-basic-app';
    const linkId = 'declare-incident';

    beforeAll(() => {
      setPluginsExtensionRegistry({
        [`plugins/${pluginId}/${linkId}`]: [
          {
            type: 'link',
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            href: `/a/${pluginId}/declare-incident`,
            key: 1,
          },
        ],
      });
    });

    it('should return a collection of extensions to the plugin', () => {
      const { extensions, error } = getPluginExtensions({
        target: `plugins/${pluginId}/${linkId}`,
      });

      expect(extensions[0].href).toBe(`/a/${pluginId}/declare-incident`);
      expect(error).toBeUndefined();
    });

    it('should return a description for the requested link', () => {
      const { extensions, error } = getPluginExtensions({
        target: `plugins/${pluginId}/${linkId}`,
      });

      expect(extensions[0].href).toBe(`/a/${pluginId}/declare-incident`);
      expect(extensions[0].description).toBe('Declaring an incident in the app');
      expect(error).toBeUndefined();
    });

    it('should return an empty array when no links can be found', () => {
      const { extensions, error } = getPluginExtensions({
        target: `an-unknown-app/${linkId}`,
      });

      expect(extensions.length).toBe(0);
      expect(error).toBeInstanceOf(PluginExtensionsMissingError);
    });
  });
});
