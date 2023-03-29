import {
  AppPluginExtensionCommandConfig,
  AppPluginExtensionLinkConfig,
  assertPluginExtensionCommand,
  PluginExtensionTypes,
} from '@grafana/data';
import { PluginExtensionRegistry } from '@grafana/runtime';

import { createPluginExtensionRegistry } from './registryFactory';

const validateLink = jest.fn((configure, context) => configure?.(context));
const configureErrorHandler = jest.fn((configure, context) => configure?.(context));
const commandErrorHandler = jest.fn((configure, context) => configure?.(context));

jest.mock('./errorHandling', () => ({
  ...jest.requireActual('./errorHandling'),
  handleErrorsInConfigure: jest.fn(() => {
    return jest.fn((configure) => {
      return jest.fn((context) => configureErrorHandler(configure, context));
    });
  }),
  handleErrorsInHandler: jest.fn(() => {
    return jest.fn((configure) => {
      return jest.fn((context) => commandErrorHandler(configure, context));
    });
  }),
}));

jest.mock('./validateLink', () => ({
  ...jest.requireActual('./validateLink'),
  createLinkValidator: jest.fn(() => {
    return jest.fn((configure) => {
      return jest.fn((context) => validateLink(configure, context));
    });
  }),
}));

describe('createPluginExtensionRegistry()', () => {
  beforeEach(() => {
    validateLink.mockClear();
    configureErrorHandler.mockClear();
    commandErrorHandler.mockClear();
  });

  describe('when registering links', () => {
    const placement1 = 'grafana/dashboard/panel/menu';
    const placement2 = 'plugins/grafana-slo-app/slo-breached';
    const pluginId = 'belugacdn-app';
    // Sample link configurations that can be used in tests
    const linkConfig = {
      placement: placement1,
      title: 'Open incident',
      description: 'You can create an incident from this context',
      path: '/a/belugacdn-app/incidents/declare',
    };

    it('should register a link extension', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [linkConfig],
          commandExtensions: [],
        },
      ]);

      shouldHaveExtensionsAtPlacement({ configs: [linkConfig], placement: placement1, registry });
    });

    it('should only register a link extension to a single placement', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [linkConfig],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 1);
      expect(registry[placement1]).toBeDefined();
    });

    it('should register link extensions from one plugin with multiple placements', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            { ...linkConfig, placement: placement1 },
            { ...linkConfig, placement: placement2 },
          ],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);
      shouldHaveExtensionsAtPlacement({ placement: placement1, configs: [linkConfig], registry });
      shouldHaveExtensionsAtPlacement({ placement: placement2, configs: [linkConfig], registry });
    });

    it('should register link extensions from multiple plugins with multiple placements', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            { ...linkConfig, placement: placement1 },
            { ...linkConfig, placement: placement2 },
          ],
          commandExtensions: [],
        },
        {
          pluginId: 'grafana-monitoring-app',
          linkExtensions: [
            { ...linkConfig, placement: placement1, path: '/a/grafana-monitoring-app/incidents/declare' },
          ],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);
      shouldHaveExtensionsAtPlacement({
        placement: placement1,
        configs: [linkConfig, { ...linkConfig, path: '/a/grafana-monitoring-app/incidents/declare' }],
        registry,
      });
      shouldHaveExtensionsAtPlacement({ placement: placement2, configs: [linkConfig], registry });
    });

    it('should register maximum 2 extensions per plugin and placement', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            { ...linkConfig, title: 'Link 1' },
            { ...linkConfig, title: 'Link 2' },
            { ...linkConfig, title: 'Link 3' },
          ],
          commandExtensions: [],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 1);

      // The 3rd link is being ignored
      shouldHaveExtensionsAtPlacement({
        placement: linkConfig.placement,
        configs: [
          { ...linkConfig, title: 'Link 1' },
          { ...linkConfig, title: 'Link 2' },
        ],
        registry,
      });
    });

    it('should not register link extensions with invalid path configured', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            {
              ...linkConfig,
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
          pluginId,
          linkExtensions: [linkConfig],
          commandExtensions: [],
        },
      ]);

      const [configure] = registry[linkConfig.placement];
      const configured = configure();

      // The default configure() function returns the same extension config
      expect(configured).toEqual({
        key: expect.any(Number),
        type: PluginExtensionTypes.link,
        title: linkConfig.title,
        description: linkConfig.description,
        path: linkConfig.path,
      });
    });

    it('should wrap the configure function with link extension validator', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            {
              ...linkConfig,
              configure: () => ({}),
            },
          ],
          commandExtensions: [],
        },
      ]);

      const [configure] = registry[linkConfig.placement];
      const context = {};

      configure(context);

      expect(validateLink).toBeCalledWith(expect.any(Function), context);
    });

    it('should wrap configure function with extension error handling', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            {
              ...linkConfig,
              configure: () => ({}),
            },
          ],
          commandExtensions: [],
        },
      ]);

      const [configure] = registry[linkConfig.placement];
      const context = {};

      configure(context);

      expect(configureErrorHandler).toBeCalledWith(expect.any(Function), context);
    });

    it('should return undefined if returned by the provided extension config', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [
            {
              ...linkConfig,
              configure: () => undefined,
            },
          ],
          commandExtensions: [],
        },
      ]);

      const [configure] = registry[linkConfig.placement];
      const context = {};

      expect(configure(context)).toBeUndefined();
    });
  });

  // Command extensions
  // ------------------
  describe('when registering commands', () => {
    const pluginId = 'belugacdn-app';
    // Sample command configurations to be used in tests
    let commandConfig1: AppPluginExtensionCommandConfig, commandConfig2: AppPluginExtensionCommandConfig;

    beforeEach(() => {
      commandConfig1 = {
        placement: 'grafana/dashboard/panel/menu',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        handler: jest.fn(),
      };
      commandConfig2 = {
        placement: 'plugins/grafana-slo-app/slo-breached',
        title: 'Open incident',
        description: 'You can create an incident from this context',
        handler: jest.fn(),
      };
    });

    it('should register a command extension', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 1);
      shouldHaveExtensionsAtPlacement({
        placement: commandConfig1.placement,
        configs: [commandConfig1],
        registry,
      });
    });

    it('should register command extensions from a SINGLE PLUGIN with MULTIPLE PLACEMENTS', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1, commandConfig2],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);
      shouldHaveExtensionsAtPlacement({
        placement: commandConfig1.placement,
        configs: [commandConfig1],
        registry,
      });
      shouldHaveExtensionsAtPlacement({
        placement: commandConfig2.placement,
        configs: [commandConfig2],
        registry,
      });
    });

    it('should register command extensions from MULTIPLE PLUGINS with MULTIPLE PLACEMENTS', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1, commandConfig2],
        },
        {
          pluginId: 'grafana-monitoring-app',
          linkExtensions: [],
          commandExtensions: [commandConfig1],
        },
      ]);

      shouldHaveNumberOfPlacements(registry, 2);

      // Both plugins register commands to the same placement
      shouldHaveExtensionsAtPlacement({
        placement: commandConfig1.placement,
        configs: [commandConfig1, commandConfig1],
        registry,
      });

      // The 'beluga-cdn-app' plugin registers a command to an other placement as well
      shouldHaveExtensionsAtPlacement({
        placement: commandConfig2.placement,
        configs: [commandConfig2],
        registry,
      });
    });

    it('should add default configure function when none is provided via the extension config', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1],
        },
      ]);

      const [configure] = registry[commandConfig1.placement];
      const configured = configure();

      // The default configure() function returns the extension config as is
      expect(configured).toEqual({
        type: PluginExtensionTypes.command,
        key: expect.any(Number),
        title: commandConfig1.title,
        description: commandConfig1.description,
        callHandlerWithContext: expect.any(Function),
      });
    });

    it('should wrap the configure function with error handling', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [
            {
              ...commandConfig1,
              configure: () => ({}),
            },
          ],
        },
      ]);

      const [configure] = registry[commandConfig1.placement];
      const context = {};

      configure(context);

      // The error handler is wrapping (decorating) the configure function, so it can provide standard error messages
      expect(configureErrorHandler).toBeCalledWith(expect.any(Function), context);
    });

    it('should return undefined if returned by the provided extension config', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [
            {
              ...commandConfig1,
              configure: () => undefined,
            },
          ],
        },
      ]);

      const [configure] = registry[commandConfig1.placement];
      const context = {};

      expect(configure(context)).toBeUndefined();
    });

    it('should wrap handler function with extension error handling', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [
            {
              ...commandConfig1,
              configure: () => ({}),
            },
          ],
        },
      ]);

      const extensions = registry[commandConfig1.placement];
      const [configure] = extensions;
      const context = {};
      const extension = configure(context);

      assertPluginExtensionCommand(extension);

      extension.callHandlerWithContext();

      expect(commandErrorHandler).toBeCalledTimes(1);
      expect(commandErrorHandler).toBeCalledWith(expect.any(Function), context);
      expect(commandConfig1.handler).toBeCalledTimes(1);
    });

    it('should wrap handler function with extension error handling when no configure function is added', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1],
        },
      ]);

      const extensions = registry[commandConfig1.placement];
      const [configure] = extensions;
      const context = {};
      const extension = configure(context);

      assertPluginExtensionCommand(extension);

      extension.callHandlerWithContext();

      expect(commandErrorHandler).toBeCalledTimes(1);
      expect(commandErrorHandler).toBeCalledWith(expect.any(Function), context);
      expect(commandConfig1.handler).toBeCalledTimes(1);
    });

    it('should call the `handler()` function with the context and a `helpers` object', () => {
      const registry = createPluginExtensionRegistry([
        {
          pluginId,
          linkExtensions: [],
          commandExtensions: [commandConfig1, { ...commandConfig2, configure: () => ({}) }],
        },
      ]);

      const context = {};
      const command1 = registry[commandConfig1.placement][0](context);
      const command2 = registry[commandConfig2.placement][0](context);

      assertPluginExtensionCommand(command1);
      assertPluginExtensionCommand(command2);

      command1.callHandlerWithContext();
      command2.callHandlerWithContext();

      expect(commandConfig1.handler).toBeCalledTimes(1);
      expect(commandConfig1.handler).toBeCalledWith(context, {
        openModal: expect.any(Function),
      });

      expect(commandConfig2.handler).toBeCalledTimes(1);
      expect(commandConfig2.handler).toBeCalledWith(context, {
        openModal: expect.any(Function),
      });
    });
  });
});

// Checks the number of total placements in the registry
function shouldHaveNumberOfPlacements(registry: PluginExtensionRegistry, numberOfPlacements: number) {
  expect(Object.keys(registry).length).toBe(numberOfPlacements);
}

// Checks if the registry has exactly the same extensions at the expected placement
function shouldHaveExtensionsAtPlacement({
  configs,
  placement,
  registry,
}: {
  configs: Array<AppPluginExtensionLinkConfig | AppPluginExtensionCommandConfig>;
  placement: string;
  registry: PluginExtensionRegistry;
}) {
  const extensions = registry[placement].map((configure) => configure());

  expect(extensions).toEqual(
    configs.map((extension) => {
      // Command extension
      if ('handler' in extension) {
        return {
          key: expect.any(Number),
          title: extension.title,
          description: extension.description,
          type: PluginExtensionTypes.command,
          callHandlerWithContext: expect.any(Function),
        };
      }

      // Link extension
      return {
        key: expect.any(Number),
        title: extension.title,
        description: extension.description,
        type: PluginExtensionTypes.link,
        path: extension.path,
      };
    })
  );
}
