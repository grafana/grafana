import { PluginsExtensionTypes } from '@grafana/data';
import { AppPluginConfig, PluginsExtensionLinkConfig } from '@grafana/runtime';

import { createPluginExtensionsRegistry } from './registry';

describe('Plugin registry', () => {
  describe('createPluginExtensionsRegistry function', () => {
    const registry = createPluginExtensionsRegistry({
      'belugacdn-app': createAppConfig([
        {
          id: '1',
          placement: 'grafana/dashboard/panel/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/belugacdn-app/incidents/declare',
        },
      ]),
      'strava-app': createAppConfig([
        {
          id: '1',
          placement: 'grafana/explore/actions',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/strava-app/incidents/declare',
        },
      ]),
      'duplicate-links-app': createAppConfig([
        {
          id: '1',
          placement: 'plugins/strava-app/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/duplicate-links-app/incidents/declare',
        },
        {
          id: '2',
          placement: 'plugins/strava-app/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/duplicate-links-app/incidents/declare2',
        },
      ]),
      'no-extensions-app': createAppConfig(undefined),
      'too-many-links-app': createAppConfig([
        {
          id: '1',
          placement: 'plugins/placement-in-ui/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/too-many-links-app/incidents/declare',
        },
        {
          id: '2',
          placement: 'plugins/placement-in-ui/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/too-many-links-app/incidents/declare2',
        },
        {
          id: '3',
          placement: 'plugins/placement-in-ui/menu',
          title: 'The title',
          type: PluginsExtensionTypes.link,
          description: 'Incidents are occurring!',
          path: '/a/too-many-links-app/incidents/declare2',
        },
      ]),
    });

    it('should configure a registry link', () => {
      const [link] = registry['grafana/dashboard/panel/menu'];

      expect(link).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        path: '/a/belugacdn-app/incidents/declare',
        key: 539074708,
      });
    });

    it('should configure all registry targets', () => {
      const numberOfTargets = Object.keys(registry).length;

      expect(numberOfTargets).toBe(4);
    });

    it('should configure registry targets from multiple plugins', () => {
      const [pluginALink] = registry['grafana/dashboard/panel/menu'];
      const [pluginBLink] = registry['grafana/explore/actions'];

      expect(pluginALink).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        path: '/a/belugacdn-app/incidents/declare',
        key: 539074708,
      });

      expect(pluginBLink).toEqual({
        title: 'The title',
        type: 'link',
        description: 'Incidents are occurring!',
        path: '/a/strava-app/incidents/declare',
        key: -1637066384,
      });
    });

    it('should configure multiple links for a single target', () => {
      const links = registry['plugins/strava-app/menu'];

      expect(links.length).toBe(2);
    });

    it('should configure maximum 2 links per plugin for a single target', () => {
      const links = registry['plugins/placement-in-ui/menu'];

      expect(links.length).toBe(2);
    });
  });
});

function createAppConfig(extensions?: PluginsExtensionLinkConfig[]): AppPluginConfig {
  return {
    id: 'myorg-basic-app',
    preload: false,
    path: '',
    version: '',
    extensions,
  };
}
