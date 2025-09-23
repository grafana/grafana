import { firstValueFrom } from 'rxjs';

import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';

import { log } from '../logs/log';
import { resetLogMock } from '../logs/testUtils';
import { isGrafanaDevMode } from '../utils';

import { AddedLinksRegistry } from './AddedLinksRegistry';
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

describe('AddedLinksRegistry', () => {
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
      addedLinks: [],
      addedComponents: [],
      addedFunctions: [],
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
    const addedLinksRegistry = new AddedLinksRegistry();
    const observable = addedLinksRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register link extensions in the registry', async () => {
    const addedLinksRegistry = new AddedLinksRegistry();

    addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockImplementation((context) => ({ title: context?.title })),
        },
      ],
    });

    const registry = await addedLinksRegistry.getState();

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'plugins/myorg-basic-app/start',
          configure: expect.any(Function),
        },
      ],
    });
  });
  it('should be possible to asynchronously register link extensions for the same placement (different plugins)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new AddedLinksRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
        {
          pluginId: pluginId2,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register link extensions for a different placement (different plugin)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new AddedLinksRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          targets: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId2,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          extensionPointId: 'plugins/myorg-basic-app/start',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register link extensions for the same placement (same plugin)', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident-1`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // Register extensions to a different extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident-2`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident-1`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
        {
          pluginId: pluginId,

          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident-2`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should be possible to asynchronously register link extensions for a different placement (same plugin)', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // Register extensions to a different extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId,

          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'plugins/myorg-basic-app/start',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should notify subscribers when the registry changes', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    observable.subscribe(subscribeCallback);

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(2);

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: 'another-plugin',
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/another-plugin/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);

    const registry = subscribeCallback.mock.calls[2][0];

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
        {
          pluginId: 'another-plugin',

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/another-plugin/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should give the last version of the registry for new subscribers', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
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

          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: expect.any(Function),
        },
      ],
    });
  });

  it('should not register a link extension if it has an invalid configure() function', () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          //@ts-ignore
          configure: '...',
        },
      ],
    });

    expect(log.error).toHaveBeenCalled();

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];
    expect(registry).toEqual({});
  });

  it('should not register a link extension if it has invalid properties (empty title / description)', () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: '',
          description: '',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(log.error).toHaveBeenCalled();

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];
    expect(registry).toEqual({});
  });

  it('should not register link extensions with invalid path configured', () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedLinksRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Title 1',
          description: 'Description 1',
          path: `/a/another-plugin/declare-incident`,
          targets: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(log.error).toHaveBeenCalled();

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const registry = subscribeCallback.mock.calls[0][0];
    expect(registry).toEqual({});
  });

  it('should not be possible to register a link on a read-only registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new AddedLinksRegistry();
    const readOnlyRegistry = registry.readOnly();

    expect(() => {
      readOnlyRegistry.register({
        pluginId,
        configs: [
          {
            title: 'Link 2',
            description: 'Link 2 description',
            path: `/a/${pluginId}/declare-incident`,
            targets: 'plugins/myorg-basic-app/start',
            configure: jest.fn().mockReturnValue({}),
          },
        ],
      });
    }).toThrow(MSG_CANNOT_REGISTER_READ_ONLY);

    const currentState = await readOnlyRegistry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should pass down fresh registrations to the read-only version of the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new AddedLinksRegistry();
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
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    // The read-only registry should have received the new extension
    readOnlyState = await readOnlyRegistry.getState();
    expect(Object.keys(readOnlyState)).toHaveLength(1);

    expect(subscribeCallback).toHaveBeenCalledTimes(2);
    expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual(['plugins/myorg-basic-app/start']);
  });

  it('should not register a link added by a plugin in dev-mode if the meta-info is missing from the plugin.json', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedLinksRegistry();
    const linkConfig = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/${pluginId}/declare-incident`,
      targets: 'grafana/dashboard/panel/menu',
      configure: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedLinks = [];

    registry.register({
      pluginId,
      configs: [linkConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should register a link added by core Grafana in dev-mode even if the meta-info is missing', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedLinksRegistry();
    const linkConfig = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/grafana/declare-incident`,
      targets: 'grafana/dashboard/panel/menu',
      configure: jest.fn().mockReturnValue({}),
    };

    registry.register({
      pluginId: 'grafana',
      configs: [linkConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a link added by a plugin in production mode even if the meta-info is missing', async () => {
    // Production mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);

    const registry = new AddedLinksRegistry();
    const linkConfig = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/${pluginId}/declare-incident`,
      targets: 'grafana/dashboard/panel/menu',
      configure: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedLinks = [];

    registry.register({
      pluginId,
      configs: [linkConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a link added by a plugin in dev-mode if the meta-info is present', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedLinksRegistry();
    const linkConfig = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/${pluginId}/declare-incident`,
      targets: ['grafana/dashboard/panel/menu'],
      configure: jest.fn().mockReturnValue({}),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedLinks = [linkConfig];

    registry.register({
      pluginId,
      configs: [linkConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });
});
