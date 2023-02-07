import { AppPluginConfig, PluginExtensionTypes, PluginsExtensionLinkConfig } from '@grafana/runtime';

import { createPluginExtensionsRegistry } from './registry';

describe('Plugin registry', () => {
  describe('createPluginExtensionsRegistry function', () => {
    const registry = createPluginExtensionsRegistry({
      'belugacdn-app': createConfig([
        {
          target: 'plugins/belugacdn-app/menu',
          title: 'The title',
          type: PluginExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/incidents/declare',
        },
      ]),
      'strava-app': createConfig([
        {
          target: 'plugins/strava-app/menu',
          title: 'The title',
          type: PluginExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/incidents/declare',
        },
      ]),
      'duplicate-links-app': createConfig([
        {
          target: 'plugins/duplicate-links-app/menu',
          title: 'The title',
          type: PluginExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/incidents/declare',
        },
        {
          target: 'plugins/duplicate-links-app/menu',
          title: 'The title',
          type: PluginExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/incidents/declare2',
        },
      ]),
      'no-extensions-app': createConfig(undefined),
    });

    it('should configure a registry link', () => {
      const [link] = registry['plugins/belugacdn-app/menu'];

      expect(link).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
        key: 539074708,
      });
    });

    it('should configure all registry targets', () => {
      const numberOfTargets = Object.keys(registry).length;

      expect(numberOfTargets).toBe(3);
    });

    it('should configure registry targets from multiple plugins', () => {
      const [pluginALink] = registry['plugins/belugacdn-app/menu'];
      const [pluginBLink] = registry['plugins/strava-app/menu'];

      expect(pluginALink).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
        key: 539074708,
      });

      expect(pluginBLink).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        href: '/a/strava-app/incidents/declare',
        key: -1637066384,
      });
    });

    it('should configure multiple links for a single target', () => {
      const links = registry['plugins/duplicate-links-app/menu'];

      expect(links.length).toBe(2);
    });
  });
});

function createConfig(extensions?: PluginsExtensionLinkConfig[]): AppPluginConfig {
  return {
    id: 'myorg-basic-app',
    preload: false,
    path: '',
    version: '',
    extensions,
  };
}
