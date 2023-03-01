import {
  AppPluginExtensionCommandConfig,
  AppPluginExtensionLinkConfig,
  PluginExtensionCommand,
  PluginExtensionTypes,
} from '@grafana/data';
import { PluginExtensionRegistry, PluginExtensionRegistryItem } from '@grafana/runtime';

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

function shouldHaveNumberOfPlacements(registry: PluginExtensionRegistry, numberOfPlacements: number) {
  expect(Object.keys(registry).length).toBe(numberOfPlacements);
}

function shouldHaveExtensionsAtPlacement({
  extensions,
  placement,
  registry,
}: {
  extensions: Array<AppPluginExtensionLinkConfig | AppPluginExtensionCommandConfig>;
  placement: string;
  registry: PluginExtensionRegistry;
}) {
  expect(registry[placement]).toEqual(
    extensions.map((extension) => {
      // Command extension
      if ('handler' in extension) {
        return {
          configure: expect.any(Function),
          extension: {
            key: expect.any(Number),
            title: extension.title,
            description: extension.description,
            type: PluginExtensionTypes.command,
            callHandlerWithContext: expect.any(Function),
          },
        };
      }

      // Link extension
      return {
        configure: expect.any(Function),
        extension: {
          key: expect.any(Number),
          title: extension.title,
          description: extension.description,
          type: PluginExtensionTypes.link,
          path: extension.path,
        },
      };
    })
  );
}

describe('createPluginExtensionRegistry()', () => {
  beforeEach(() => {
    validateLink.mockClear();
    errorHandler.mockClear();
  });

  describe('when registering links', () => {
    const placement = 'grafana/dashboard/panel/menu';
    const samplePluginId = 'belugacdn-app';
    const sampleLink = {
      placement,
      title: 'Open incident',
      description: 'You can create an incident from this context',
      path: `/a/${samplePluginId}/incidents/declare`,
    };

    it('should register a link extension', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId: samplePluginId,
          linkExtensions: [sampleLink],
          commandExtensions: [],
        },
      ]);

      shouldHaveExtensionsAtPlacement({ extensions: [sampleLink], placement, registry });
    });

    it('should only register a link extension to a single placement', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId: samplePluginId,
          linkExtensions: [sampleLink],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 1);
      expect(registry[placement]).toBeDefined();
    });

    it('should register link extensions from one plugin with multiple placements', () => {
      const link1 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        path: '/a/belugacdn-app/incidents/declare',
      };
      const link2 = {
        placement: 'plugins/grafana-slo-app/slo-breached',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        path: '/a/belugacdn-app/incidents/declare',
      };
      const registry = createPluginExtensionRegistry([
        {
          pluginId: 'belugacdn-app',
          linkExtensions: [link1, link2],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);
      shouldHaveExtensionsAtPlacement({ placement: link1.placement, extensions: [link1], registry });
      shouldHaveExtensionsAtPlacement({ placement: link2.placement, extensions: [link2], registry });
    });

    it('should register link extensions from multiple plugins with multiple placements', () => {
      const link1 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        path: '/a/belugacdn-app/incidents/declare',
      };
      const link2 = {
        placement: 'plugins/grafana-slo-app/slo-breached',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        path: '/a/belugacdn-app/incidents/declare',
      };
      const link3 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open Incident',
        description: 'You can create an incident from this context',
        path: '/a/grafana-monitoring-app/incidents/declare',
      };
      const registry = createPluginExtensionRegistry([
        {
          pluginId: 'belugacdn-app',
          linkExtensions: [link1, link2],
          commandExtensions: [],
        },
        {
          pluginId: 'grafana-monitoring-app',
          linkExtensions: [link3],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);
      shouldHaveExtensionsAtPlacement({ placement: link1.placement, extensions: [link1, link3], registry });
      shouldHaveExtensionsAtPlacement({ placement: link2.placement, extensions: [link2], registry });
    });

    it('should register maximum 2 extensions per plugin and placement', () => {
      const pluginId = 'belugacdn-app';
      const link1 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        path: `/a/${pluginId}/incidents/declare`,
      };
      const link2 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident 2',
        description: 'You can create an incident from this context',
        path: `/a/${pluginId}/incidents/declare`,
      };
      const link3 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident 3',
        description: 'You can create an incident from this context',
        path: `/a/${pluginId}/incidents/declare`,
      };
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [link1, link2, link3],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 1);

      // The 3rd link is being ignored
      shouldHaveExtensionsAtPlacement({ placement: link1.placement, extensions: [link1, link2], registry });
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
              path: '/incidents/declare', // invalid path, should always be prefixed with the plugin id
            },
          ],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 0);
    });

    it('should add default configure function when none provided via extension config', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId: 'belugacdn-app',
          linkExtensions: [sampleLink],
          commandExtensions: [],
        },
      ]);

      const [extension] = registry[sampleLink.placement];
      const configured = extension.configure();

      // The default configure() function returns the same extension config
      expect(configured).toEqual({
        key: expect.any(Number),
        type: PluginExtensionTypes.link,
        title: sampleLink.title,
        description: sampleLink.description,
        path: sampleLink.path,
      });
    });

    it('should wrap the configure function with link extension validator', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId: 'belugacdn-app',
          linkExtensions: [
            {
              ...sampleLink,
              configure: () => ({}),
            },
          ],
          commandExtensions: [],
        },
      ]);

      const [{ configure }] = registry[sampleLink.placement];
      const context = {};
      const configurable = {
        title: sampleLink.title,
        description: sampleLink.description,
        path: sampleLink.path,
      };

      configure(context);

      expect(validateLink).toBeCalledWith(expect.any(Function), configurable, context);
    });

    it('should wrap configure function with extension error handling', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId: 'belugacdn-app',
          linkExtensions: [
            {
              ...sampleLink,
              configure: () => ({}),
            },
          ],
          commandExtensions: [],
        },
      ]);

      const [{ configure }] = registry[sampleLink.placement];
      const context = {};
      const configurable = {
        title: sampleLink.title,
        description: sampleLink.description,
        path: sampleLink.path,
      };

      configure(context);

      expect(errorHandler).toBeCalledWith(expect.any(Function), configurable, context);
    });
  });

  describe('when registering commands', () => {
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
          configure: expect.any(Function),
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
          configure: expect.any(Function),
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
          configure: expect.any(Function),
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
          configure: expect.any(Function),
          extension: {
            title: 'Open incident',
            type: PluginExtensionTypes.command,
            description: 'You can create an incident from this context',
            key: -68154691,
            callHandlerWithContext: expect.any(Function),
          },
        },
        {
          configure: expect.any(Function),
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
          configure: expect.any(Function),
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

    it('should add default configure function when none provided via extension config', () => {
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

      const [extension] = registry['grafana/dashboard/panel/menu'];
      const configured = extension.configure();

      expect(configured).toEqual({
        title: 'Open incident',
        type: PluginExtensionTypes.command,
        description: 'You can create an incident from this context',
        key: -68154691,
        callHandlerWithContext: expect.any(Function),
      });
    });

    it('should wrap configure function with extension error handling', () => {
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
              configure: () => ({}),
            },
          ],
        },
      ]);

      const extensions = registry['grafana/dashboard/panel/menu'];
      const [extension] = extensions;

      const context = {};
      const configurable = {
        title: 'Open incident',
        description: 'You can create an incident from this context',
      };

      extension?.configure?.(context);

      expect(errorHandler).toBeCalledWith(expect.any(Function), configurable, context);
    });
  });
});
