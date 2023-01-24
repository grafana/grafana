import type { AppPluginConfig, PluginsExtensionConfig } from '@grafana/runtime';

import { createPluginExtensionsRegistry } from './registry';

describe('Plugin registry', () => {
  describe('createPluginExtensionsRegistry function', () => {
    const registry = createPluginExtensionsRegistry({
      'belugacdn-app': createConfig({
        links: [
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare',
          },
        ],
      }),
      'strava-app': createConfig({
        links: [
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare',
          },
        ],
      }),
      'duplicate-links-app': createConfig({
        links: [
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare',
          },
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare2',
          },
        ],
      }),
      'no-extensions-app': createConfig(undefined),
    });

    it('should configure a registry link', () => {
      const link = registry.links['belugacdn-app.declare-incident'];

      expect(link).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
      });
    });

    it('should configure all registry links', () => {
      const numberOfLinks = Object.keys(registry.links).length;

      expect(numberOfLinks).toBe(3);
    });

    it('should configure registry links from multiple plugins', () => {
      const pluginALink = registry.links['belugacdn-app.declare-incident'];
      const pluginBLink = registry.links['strava-app.declare-incident'];

      expect(pluginALink).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
      });

      expect(pluginBLink).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/strava-app/incidents/declare',
      });
    });

    it('should configure first link when duplicates exist', () => {
      const link = registry.links['duplicate-links-app.declare-incident'];

      expect(link).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/duplicate-links-app/incidents/declare',
      });
    });
  });
});

function createConfig(extensions?: PluginsExtensionConfig): AppPluginConfig {
  return {
    id: 'myorg-basic-app',
    preload: false,
    path: '',
    version: '',
    extensions,
  };
}
