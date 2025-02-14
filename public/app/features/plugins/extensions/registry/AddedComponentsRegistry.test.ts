import React from 'react';
import { firstValueFrom } from 'rxjs';

import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';

import { log } from '../logs/log';
import { resetLogMock } from '../logs/testUtils';
import { isGrafanaDevMode } from '../utils';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
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

describe('AddedComponentsRegistry', () => {
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
    const reactiveRegistry = new AddedComponentsRegistry();
    const observable = reactiveRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register added components in the registry', async () => {
    const extensionPointId = `${pluginId}/hello-world/v1`;
    const reactiveRegistry = new AddedComponentsRegistry();

    reactiveRegistry.register({
      pluginId,
      configs: [
        {
          targets: [extensionPointId],
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World'),
        },
      ],
    });

    const registry = await reactiveRegistry.getState();

    expect(Object.keys(registry)).toHaveLength(1);
    expect(registry[extensionPointId][0]).toMatchObject({
      pluginId,
      title: 'not important',
      description: 'not important',
    });
  });

  it('should be possible to asynchronously register component extensions for the same extension point (different plugins)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const extensionPointId = 'grafana/alerting/home';
    const reactiveRegistry = new AddedComponentsRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();
    expect(Object.keys(registry1)).toHaveLength(1);
    expect(registry1[extensionPointId][0]).toMatchObject({
      pluginId: pluginId1,
      title: 'Component 1 title',
      description: 'Component 1 description',
    });

    // Register an extension component for the second plugin to the same extension point
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Component 2 title',
          description: 'Component 2 description',
          targets: [extensionPointId],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();
    expect(Object.keys(registry2)).toHaveLength(1);
    expect(registry2[extensionPointId]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
        expect.objectContaining({
          pluginId: pluginId2,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ])
    );
  });

  it('should be possible to asynchronously register component extensions for a different extension points (different plugin)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const extensionPointId1 = 'grafana/alerting/home';
    const extensionPointId2 = 'grafana/user/profile/tab';
    const reactiveRegistry = new AddedComponentsRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: [extensionPointId1],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getState();
    expect(registry1).toEqual({
      [extensionPointId1]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
    });

    // Register an extension component for the second plugin to a different extension point
    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Component 2 title',
          description: 'Component 2 description',
          targets: [extensionPointId2],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      [extensionPointId1]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      [extensionPointId2]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId2,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ]),
    });
  });

  it('should be possible to asynchronously register component extensions for the same extension point (same plugin)', async () => {
    const reactiveRegistry = new AddedComponentsRegistry();
    const extensionPointId = 'grafana/alerting/home';

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: [extensionPointId],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
        {
          title: 'Component 2 title',
          description: 'Component 2 description',
          targets: [extensionPointId],
          component: () => React.createElement('div', null, 'Hello World2'),
        },
      ],
    });
    const registry1 = await reactiveRegistry.getState();
    expect(registry1).toEqual({
      [extensionPointId]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
        expect.objectContaining({
          pluginId: pluginId,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ]),
    });
  });

  it('should be possible to register one extension component targeting multiple extension points', async () => {
    const reactiveRegistry = new AddedComponentsRegistry();
    const extensionPointId1 = 'grafana/alerting/home';
    const extensionPointId2 = 'grafana/user/profile/tab';

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: [extensionPointId1, extensionPointId2],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });
    const registry1 = await reactiveRegistry.getState();
    expect(registry1).toEqual({
      [extensionPointId1]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      [extensionPointId2]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
    });
  });

  it('should notify subscribers when the registry changes', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'myorg-extensions-app';
    const extensionPointId1 = 'grafana/alerting/home';
    const extensionPointId2 = 'grafana/user/profile/tab';
    const reactiveRegistry = new AddedComponentsRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    observable.subscribe(subscribeCallback);

    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: [extensionPointId1],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(2);

    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          title: 'Component 2 title',
          description: 'Component 2 description',
          targets: [extensionPointId2],
          component: () => React.createElement('div', null, 'Hello World2'),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);

    const registry = subscribeCallback.mock.calls[2][0];

    expect(registry).toEqual({
      [extensionPointId1]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      [extensionPointId2]: expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId2,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ]),
    });
  });

  it('should not register component when title is missing', async () => {
    const registry = new AddedComponentsRegistry();
    const extensionPointId = 'grafana/alerting/home';

    registry.register({
      pluginId,
      configs: [
        {
          title: '',
          description: '',
          targets: [extensionPointId],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(log.error).toHaveBeenCalledWith('Could not register component extension. Reason: Title is missing.');

    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should not be possible to register a component on a read-only registry', async () => {
    const registry = new AddedComponentsRegistry();
    const readOnlyRegistry = registry.readOnly();
    const extensionPointId = 'grafana/alerting/home';

    expect(() => {
      readOnlyRegistry.register({
        pluginId,
        configs: [
          {
            title: 'Component 1 title',
            description: '',
            targets: [extensionPointId],
            component: () => React.createElement('div', null, 'Hello World1'),
          },
        ],
      });
    }).toThrow(MSG_CANNOT_REGISTER_READ_ONLY);

    const currentState = await readOnlyRegistry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should pass down fresh registrations to the read-only version of the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new AddedComponentsRegistry();
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
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    // The read-only registry should have received the new extension
    readOnlyState = await readOnlyRegistry.getState();
    expect(Object.keys(readOnlyState)).toHaveLength(1);

    expect(subscribeCallback).toHaveBeenCalledTimes(2);
    expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual(['grafana/alerting/home']);
  });

  it('should not register a component added by a plugin in dev-mode if the meta-info is missing from the plugin.json', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedComponentsRegistry();
    const componentConfig = {
      title: 'Component title',
      description: 'Component description',
      targets: ['grafana/alerting/home'],
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedComponents = [];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should register a component added by a core Grafana in dev-mode even if the meta-info is missing', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedComponentsRegistry();
    const componentConfig = {
      title: 'Component title',
      description: 'Component description',
      targets: ['grafana/alerting/home'],
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    registry.register({
      pluginId: 'grafana',
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a component added by a plugin in production mode even if the meta-info is missing', async () => {
    // Production mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);

    const registry = new AddedComponentsRegistry();
    const componentConfig = {
      title: 'Component title',
      description: 'Component description',
      targets: ['grafana/alerting/home'],
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedComponents = [];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register a component added by a plugin in dev-mode if the meta-info is present', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new AddedComponentsRegistry();
    const componentConfig = {
      title: 'Component title',
      description: 'Component description',
      targets: ['grafana/alerting/home'],
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.addedComponents = [componentConfig];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.warning).not.toHaveBeenCalled();
  });
});
