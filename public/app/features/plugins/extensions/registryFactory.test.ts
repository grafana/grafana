import { PluginExtensionTypes } from '@grafana/data';

import { createPluginExtensionRegistry } from './registryFactory';

describe('Creating extensions registry', () => {
  it('should register an extension', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
        ],
      },
    ]);

    const numberOfPlacements = Object.keys(registry).length;
    const extensions = registry['grafana/dashboard/panel/menu'];

    expect(numberOfPlacements).toBe(1);
    expect(extensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -68154691,
        },
      },
    ]);
  });

  it('should register extensions from one plugin with multiple placements', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
          {
            placement: 'plugins/grafana-slo-app/slo-breached',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
        ],
      },
    ]);

    const numberOfPlacements = Object.keys(registry).length;
    const panelExtensions = registry['grafana/dashboard/panel/menu'];
    const sloExtensions = registry['plugins/grafana-slo-app/slo-breached'];

    expect(numberOfPlacements).toBe(2);
    expect(panelExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -68154691,
        },
      },
    ]);
    expect(sloExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -1638987831,
        },
      },
    ]);
  });

  it('should register extensions from multiple plugins with multiple placements', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
          {
            placement: 'plugins/grafana-slo-app/slo-breached',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
        ],
      },
      {
        pluginId: 'grafana-monitoring-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open Incident',
            description: 'You can create an incident from this context',
            path: '/a/grafana-monitoring-app/incidents/declare',
          },
        ],
      },
    ]);

    const numberOfPlacements = Object.keys(registry).length;
    const panelExtensions = registry['grafana/dashboard/panel/menu'];
    const sloExtensions = registry['plugins/grafana-slo-app/slo-breached'];

    expect(numberOfPlacements).toBe(2);
    expect(panelExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -68154691,
        },
      },
      {
        configure: undefined,
        extension: {
          title: 'Open Incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/grafana-monitoring-app/incidents/declare',
          key: -540306829,
        },
      },
    ]);

    expect(sloExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -1638987831,
        },
      },
    ]);
  });

  it('should register maximum 2 extensions per plugin and placement', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident 2',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident 3',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
          },
        ],
      },
    ]);

    const numberOfPlacements = Object.keys(registry).length;
    const panelExtensions = registry['grafana/dashboard/panel/menu'];

    expect(numberOfPlacements).toBe(1);
    expect(panelExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -68154691,
        },
      },
      {
        configure: undefined,
        extension: {
          title: 'Open incident 2',
          type: PluginExtensionTypes.link,
          description: 'You can create an incident from this context',
          path: '/a/belugacdn-app/incidents/declare',
          key: -1072147569,
        },
      },
    ]);
  });
});
