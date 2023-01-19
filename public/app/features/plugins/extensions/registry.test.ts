import { PluginExtensions } from '@grafana/data';

import { configurePluginExtensions, getRegistry } from './registry';

describe('Plugin registry', () => {
  describe('configurePluginExtensions function', () => {
    const bootRegistry: Record<string, PluginExtensions> = {
      'belugacdn-app': {
        links: [
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare',
          },
        ],
      },
      'strava-app': {
        links: [
          {
            id: 'declare-incident',
            description: 'Incidents are occurring!',
            path: '/incidents/declare',
          },
        ],
      },
      'duplicate-links-app': {
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
      },
    };

    beforeEach(() => {
      configurePluginExtensions(bootRegistry);
    });

    it('should configure a registry link', () => {
      const registry = getRegistry();
      const link = registry.links['belugacdn-app.declare-incident'];

      expect(link).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/belugacdn-app/incidents/declare',
      });
    });

    it('should configure registry links', () => {
      const registry = getRegistry();
      const numberOfLinks = Object.keys(registry.links).length;

      expect(numberOfLinks).toBe(3);
    });

    it('should configure registry links from multiple plugins', () => {
      const registry = getRegistry();
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

    it('should configure first link when duplicates exists', () => {
      const registry = getRegistry();
      const link = registry.links['duplicate-links-app.declare-incident'];

      expect(link).toEqual({
        description: 'Incidents are occurring!',
        href: '/a/duplicate-links-app/incidents/declare',
      });
    });
  });
});
