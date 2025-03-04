import { firstValueFrom } from 'rxjs';

import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';

import { log } from '../logs/log';
import { resetLogMock } from '../logs/testUtils';
import { isGrafanaDevMode } from '../utils';

import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { MSG_CANNOT_REGISTER_READ_ONLY } from './Registry';

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),

  // Manually set the dev mode to false
  // (to make sure that by default we are testing a production scneario)
  isGrafanaDevMode: jest.fn().mockReturnValue(false),
}));

jest.mock('../logs/log', () => {
  const { createLogMock } = jest.requireActual('../logs/testUtils');
  const original = jest.requireActual('../logs/log');

  return {
    ...original,
    log: createLogMock(),
  };
});

describe('addedFunctionsRegistry', () => {
  const originalApps = config.apps;
  const pluginId = 'grafana-basic-app';
  const appPluginConfig = {
    id: pluginId,
    path: '',
    version: '',
    preload: false,
    angular: {
      detected: false,
      hideDeprecation: false,
    },
    loadingStrategy: PluginLoadingStrategy.fetch,
    dependencies: {
      grafanaVersion: '8.0.0',
      plugins: [],
      extensions: {
        exposedComponents: [],
      },
    },
    extensions: {
      addedFunctions: [],
      addedLinks: [],
      addedComponents: [],
      exposedComponents: [],
      extensionPoints: [],
    },
  };

  beforeEach(() => {
    resetLogMock(log);
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
    config.apps = {
      [pluginId]: appPluginConfig,
    };
  });

  afterEach(() => {
    config.apps = originalApps;
  });

  it('should return empty registry when no extensions registered', async () => {
    const addedFunctionsRegistry = new AddedFunctionsRegistry();
    const observable = addedFunctionsRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register function extensions in the registry', async () => {
    const addedFunctionsRegistry = new AddedFunctionsRegistry();

    addedFunctionsRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn(),
        },
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'plugins/myorg-basic-app/start',
          fn: jest.fn(),
        },
      ],
    });

    const registry = await addedFunctionsRegistry.getState();

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId,
          title: 'Function 2',
          description: 'Function 2 description',
          extensionPointId: 'plugins/myorg-basic-app/start',
          fn: expect.any(Function),
        },
      ],
    });
  });
  it('should be possible to asynchronously register function extensions for the same placement (different plugins)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new AddedFunctionsRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
        {
          pluginId: pluginId2,
          title: 'Function 2',
          description: 'Function 2 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register function extensions for a different placement (different plugin)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new AddedFunctionsRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,

          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'plugins/myorg-basic-app/start',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId2,
          title: 'Function 2',
          description: 'Function 2 description',
          extensionPointId: 'plugins/myorg-basic-app/start',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register function extensions for the same placement (same plugin)', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // Register extensions to a different extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,

          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
        {
          pluginId: pluginId,

          title: 'Function 2',
          description: 'Function 2 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register function extensions for a different placement (same plugin)', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // Register extensions to a different extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'plugins/myorg-basic-app/start',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,

          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId,

          title: 'Function 2',
          description: 'Function 2 description',
          extensionPointId: 'plugins/myorg-basic-app/start',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should notify subscribers when the registry changes', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    observable.subscribe(subscribeCallback);

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(2);

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: 'another-plugin',
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);

    const registry = subscribeCallback.mock.calls[2][0];

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
        {
          pluginId: 'another-plugin',
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should give the last version of the registry for new subscribers', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,
          title: 'Function 1',
          description: 'Function 1 description',
          extensionPointId: 'grafana/dashboard/panel/menu',
          fn: expect.any(Function),
        },
      ],
    });
  });

  it('should not register a function extension if it has an invalid fn function', () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Function 1',
          description: 'Function 1 description',
          targets: 'grafana/dashboard/panel/menu',
          //@ts-ignore
          fn: '...',
        },
      ],
    });

    expect(log.error).toHaveBeenCalled();

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];
    expect(registry).toEqual({});
  });

  it('should not register a function extension if it has invalid properties (empty title)', () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedFunctionsRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: '',
          targets: 'grafana/dashboard/panel/menu',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(log.error).toHaveBeenCalled();

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];
    expect(registry).toEqual({});
  });

  it('should not be possible to register a function on a read-only registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new AddedFunctionsRegistry();
    const readOnlyRegistry = registry.readOnly();

    expect(() => {
      readOnlyRegistry.register({
        pluginId,
        configs: [
          {
            title: 'Function 2',
            description: 'Function 2 description',
            targets: 'plugins/myorg-basic-app/start',
            fn: jest.fn().mockReturnValue({}),
          },
        ],
      });
    }).toThrow(MSG_CANNOT_REGISTER_READ_ONLY);

    const currentState = await readOnlyRegistry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should pass down fresh registrations to the read-only version of the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new AddedFunctionsRegistry();
    const readOnlyRegistry = registry.readOnly();
    const subscribeCallback = jest.fn();
    let readOnlyState;

    // Should have no extensions registered in the beginning
    readOnlyState = await readOnlyRegistry.getState();
    expect(Object.keys(readOnlyState)).toHaveLength(0);

    readOnlyRegistry.asObservable().subscribe(subscribeCallback);

    // Register an extension to the original (writable) registry
    registry.register({
      pluginId,
      configs: [
        {
          title: 'Function 2',
          description: 'Function 2 description',
          targets: 'plugins/myorg-basic-app/start',
          fn: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // The read-only registry should have received the new extension
    readOnlyState = await readOnlyRegistry.getState();
    expect(Object.keys(readOnlyState)).toHaveLength(1);

    expect(subscribeCallback).toHaveBeenCalledTimes(2);
    expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual(['plugins/myorg-basic-app/start']);
  });

  it('should not register a function added by a plugin in dev-mode if the meta-info is missing from the plugin.json', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedFunctionsRegistry();
    const fnConfig = {
      title: 'Function 1',
      description: 'Function 1 description',
      targets: 'grafana/dashboard/panel/menu',
      fn: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedFunctions = [];

    registry.register({
      pluginId,
      configs: [fnConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should register a function added by core Grafana in dev-mode even if the meta-info is missing', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedFunctionsRegistry();
    const fnConfig = {
      title: 'Function 1',
      description: 'Function 1 description',
      targets: 'grafana/dashboard/panel/menu',
      fn: jest.fn().mockReturnValue({}),
    };

    registry.register({
      pluginId: 'grafana',
      configs: [fnConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a function added by a plugin in production mode even if the meta-info is missing', async () => {
    // Production mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);

    const registry = new AddedFunctionsRegistry();
    const fnConfig = {
      title: 'Function 1',
      description: 'Function 1 description',
      targets: 'grafana/dashboard/panel/menu',
      fn: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedFunctions = [];

    registry.register({
      pluginId,
      configs: [fnConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a function added by a plugin in dev-mode if the meta-info is present', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedFunctionsRegistry();
    const fnConfig = {
      title: 'Function 1',
      description: 'Function 1 description',
      targets: ['grafana/dashboard/panel/menu'],
      fn: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedFunctions = [fnConfig];

    registry.register({
      pluginId,
      configs: [fnConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });
});
