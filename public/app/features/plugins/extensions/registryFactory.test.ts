import { PluginExtensionTypes } from '@grafana/data';

import { createPluginExtensionRegistry } from './registryFactory';

const validateLink = jest.fn((configure, extension, context) => configure?.(extension, context));
const errorHandler = jest.fn((configure, extension, context) => configure?.(extension, context));

jest.mock('./errorHandling', () => ({
  ...jest.requireActual('./errorHandling'),
  createErrorHandling: jest.fn(() => {
    return jest.fn((configure) => {
      return jest.fn((extension, context) => errorHandler(configure, extension, context));
    });
  }),
}));

jest.mock('./validateLink', () => ({
  ...jest.requireActual('./validateLink'),
  createLinkValidator: jest.fn(() => {
    return jest.fn((configure) => {
      return jest.fn((extension, context) => validateLink(configure, extension, context));
    });
  }),
}));

describe('Creating extensions registry', () => {
  beforeEach(() => {
    validateLink.mockClear();
    errorHandler.mockClear();
  });

  it('should register a link extension', () => {
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
        commandExtensions: [],
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

  it('should register link extensions from one plugin with multiple placements', () => {
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
        commandExtensions: [],
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

  it('should register link extensions from multiple plugins with multiple placements', () => {
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
        commandExtensions: [],
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
        commandExtensions: [],
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
        commandExtensions: [],
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

  it('should not register link extensions with invalid path configured', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/incidents/declare',
          },
        ],
        commandExtensions: [],
      },
    ]);

    const numberOfPlacements = Object.keys(registry).length;
    expect(numberOfPlacements).toBe(0);
  });

  it('should wrap configure function with link extension validator', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
            configure: () => ({}),
          },
        ],
        commandExtensions: [],
      },
    ]);

    const extensions = registry['grafana/dashboard/panel/menu'];
    const [extension] = extensions;

    const context = {};
    const configurable = {
      title: 'Open incident',
      description: 'You can create an incident from this context',
      path: '/a/belugacdn-app/incidents/declare',
    };

    extension?.configure?.(context);

    expect(validateLink).toBeCalledWith(expect.any(Function), configurable, context);
  });

  it('should wrap configure function with extension error handling', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            path: '/a/belugacdn-app/incidents/declare',
            configure: () => ({}),
          },
        ],
        commandExtensions: [],
      },
    ]);

    const extensions = registry['grafana/dashboard/panel/menu'];
    const [extension] = extensions;

    const context = {};
    const configurable = {
      title: 'Open incident',
      description: 'You can create an incident from this context',
      path: '/a/belugacdn-app/incidents/declare',
    };

    extension?.configure?.(context);

    expect(errorHandler).toBeCalledWith(expect.any(Function), configurable, context);
  });

  it('should register a command extension', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [],
        commandExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            handler: () => {},
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
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -68154691,
          callHandlerWithContext: expect.any(Function),
        },
      },
    ]);
  });

  it('should register command extensions from one plugin with multiple placements', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [],
        commandExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            handler: () => {},
          },
          {
            placement: 'plugins/grafana-slo-app/slo-breached',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            handler: () => {},
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
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -68154691,
          callHandlerWithContext: expect.any(Function),
        },
      },
    ]);
    expect(sloExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -1638987831,
          callHandlerWithContext: expect.any(Function),
        },
      },
    ]);
  });

  it('should register command extensions from multiple plugins with multiple placements', () => {
    const registry = createPluginExtensionRegistry([
      {
        pluginId: 'belugacdn-app',
        linkExtensions: [],
        commandExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            handler: () => {},
          },
          {
            placement: 'plugins/grafana-slo-app/slo-breached',
            title: 'Open incident',
            description: 'You can create an incident from this context',
            handler: () => {},
          },
        ],
      },
      {
        pluginId: 'grafana-monitoring-app',
        linkExtensions: [],
        commandExtensions: [
          {
            placement: 'grafana/dashboard/panel/menu',
            title: 'Open Incident',
            description: 'You can create an incident from this context',
            handler: () => {},
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
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -68154691,
          callHandlerWithContext: expect.any(Function),
        },
      },
      {
        configure: undefined,
        extension: {
          title: 'Open Incident',
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -540306829,
          callHandlerWithContext: expect.any(Function),
        },
      },
    ]);

    expect(sloExtensions).toEqual([
      {
        configure: undefined,
        extension: {
          title: 'Open incident',
          type: PluginExtensionTypes.command,
          description: 'You can create an incident from this context',
          key: -1638987831,
          callHandlerWithContext: expect.any(Function),
        },
      },
    ]);
  });
});
