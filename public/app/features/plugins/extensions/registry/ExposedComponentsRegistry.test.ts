import React from 'react';
import { firstValueFrom } from 'rxjs';

import { PluginLoadingStrategy } from '@grafana/data';
import { config } from '@grafana/runtime';

import { log } from '../logs/log';
import { resetLogMock } from '../logs/testUtils';
import { isGrafanaDevMode } from '../utils';

import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
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

describe('ExposedComponentsRegistry', () => {
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

  it('should return empty registry when no exposed components have been registered', async () => {
    const reactiveRegistry = new ExposedComponentsRegistry();
    const observable = reactiveRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register exposed components in the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const id = `${pluginId}/hello-world/v1`;
    const reactiveRegistry = new ExposedComponentsRegistry();

    reactiveRegistry.register({
      pluginId,
      configs: [
        {
          id,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World'),
        },
      ],
    });

    const registry = await reactiveRegistry.getState();

    expect(Object.keys(registry)).toHaveLength(1);
    expect(registry[id]).toMatchObject({
      pluginId,
      id,
      title: 'not important',
      description: 'not important',
    });
  });

  it('should be possible to register multiple exposed components at one time', async () => {
    const pluginId = 'grafana-basic-app';
    const id1 = `${pluginId}/hello-world1/v1`;
    const id2 = `${pluginId}/hello-world2/v1`;
    const id3 = `${pluginId}/hello-world3/v1`;
    const reactiveRegistry = new ExposedComponentsRegistry();

    reactiveRegistry.register({
      pluginId,
      configs: [
        {
          id: id1,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
        {
          id: id2,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World2'),
        },
        {
          id: id3,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World3'),
        },
      ],
    });

    const registry = await reactiveRegistry.getState();

    expect(Object.keys(registry)).toHaveLength(3);
    expect(registry[id1]).toMatchObject({ id: id1, pluginId });
    expect(registry[id2]).toMatchObject({ id: id2, pluginId });
    expect(registry[id3]).toMatchObject({ id: id3, pluginId });
  });

  it('should be possible to register multiple exposed components from multiple plugins', async () => {
    const pluginId1 = 'grafana-basic-app1';
    const pluginId2 = 'grafana-basic-app2';
    const id1 = `${pluginId1}/hello-world1/v1`;
    const id2 = `${pluginId1}/hello-world2/v1`;
    const id3 = `${pluginId2}/hello-world1/v1`;
    const id4 = `${pluginId2}/hello-world2/v1`;
    const reactiveRegistry = new ExposedComponentsRegistry();

    reactiveRegistry.register({
      pluginId: pluginId1,
      configs: [
        {
          id: id1,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
        {
          id: id2,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World2'),
        },
      ],
    });

    reactiveRegistry.register({
      pluginId: pluginId2,
      configs: [
        {
          id: id3,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World3'),
        },
        {
          id: id4,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World4'),
        },
      ],
    });

    const registry = await reactiveRegistry.getState();

    expect(Object.keys(registry)).toHaveLength(4);
    expect(registry[id1]).toMatchObject({ id: id1, pluginId: pluginId1 });
    expect(registry[id2]).toMatchObject({ id: id2, pluginId: pluginId1 });
    expect(registry[id3]).toMatchObject({ id: id3, pluginId: pluginId2 });
    expect(registry[id4]).toMatchObject({ id: id4, pluginId: pluginId2 });
  });

  it('should notify subscribers when the registry changes', async () => {
    const registry = new ExposedComponentsRegistry();
    const observable = registry.asObservable();
    const subscribeCallback = jest.fn();

    observable.subscribe(subscribeCallback);

    // Register extensions for the first plugin
    registry.register({
      pluginId: 'grafana-basic-app1',
      configs: [
        {
          id: 'grafana-basic-app1/hello-world/v1',
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(2);

    // Register exposed components for the second plugin
    registry.register({
      pluginId: 'grafana-basic-app2',
      configs: [
        {
          id: 'grafana-basic-app2/hello-world/v1',
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);

    const mock = subscribeCallback.mock.calls[2][0];
    expect(mock).toHaveProperty('grafana-basic-app1/hello-world/v1');
    expect(mock).toHaveProperty('grafana-basic-app2/hello-world/v1');
  });

  it('should give the last version of the registry for new subscribers', async () => {
    const registry = new ExposedComponentsRegistry();
    const observable = registry.asObservable();
    const subscribeCallback = jest.fn();

    // Register extensions for the first plugin
    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          id: 'grafana-basic-app/hello-world/v1',
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    observable.subscribe(subscribeCallback);
    expect(subscribeCallback).toHaveBeenCalledTimes(1);

    const mock = subscribeCallback.mock.calls[0][0];

    expect(mock['grafana-basic-app/hello-world/v1']).toMatchObject({
      pluginId: 'grafana-basic-app',
      id: 'grafana-basic-app/hello-world/v1',
      title: 'not important',
      description: 'not important',
    });
  });

  it('should log an error if another component with the same id already exists in the registry', async () => {
    const registry = new ExposedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app1',
      configs: [
        {
          id: 'grafana-basic-app1/hello-world/v1',
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const currentState1 = await registry.getState();
    expect(Object.keys(currentState1)).toHaveLength(1);
    expect(currentState1['grafana-basic-app1/hello-world/v1']).toMatchObject({
      pluginId: 'grafana-basic-app1',
      id: 'grafana-basic-app1/hello-world/v1',
    });

    registry.register({
      pluginId: 'grafana-basic-app1',
      configs: [
        {
          id: 'grafana-basic-app1/hello-world/v1', // incorrectly scoped
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(log.error).toHaveBeenCalledWith(
      'Could not register exposed component. Reason: An exposed component with the same id already exists.'
    );
    const currentState2 = await registry.getState();
    expect(Object.keys(currentState2)).toHaveLength(1);
  });

  it('should skip registering component and log an error when id is not prefixed with plugin id', async () => {
    const registry = new ExposedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app1',
      configs: [
        {
          id: 'hello-world/v1',
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(log.error).toHaveBeenCalledWith(
      "Could not register exposed component. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'."
    );
    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should not register component when title is missing', async () => {
    const registry = new ExposedComponentsRegistry();

    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          id: 'grafana-basic-app/hello-world/v1',
          title: '',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(log.error).toHaveBeenCalledWith('Could not register exposed component. Reason: Title is missing.');

    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should not be possible to register a component on a read-only registry', async () => {
    const pluginId = 'grafana-basic-app';
    const registry = new ExposedComponentsRegistry();
    const readOnlyRegistry = registry.readOnly();

    expect(() => {
      readOnlyRegistry.register({
        pluginId,
        configs: [
          {
            id: `${pluginId}/hello-world/v1`,
            title: 'not important',
            description: 'not important',
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
    const registry = new ExposedComponentsRegistry();
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
          id: `${pluginId}/hello-world/v1`,
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    // The read-only registry should have received the new extension
    readOnlyState = await readOnlyRegistry.getState();
    expect(Object.keys(readOnlyState)).toHaveLength(1);

    expect(subscribeCallback).toHaveBeenCalledTimes(2);
    expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual([`${pluginId}/hello-world/v1`]);
  });

  it('should not register an exposed component added by a plugin in dev-mode if the meta-info is missing from the plugin.json', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new ExposedComponentsRegistry();
    const componentConfig = {
      id: `${pluginId}/exposed-component/v1`,
      title: 'Component title',
      description: 'Component description',
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.exposedComponents = [];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(0);
    expect(log.error).toHaveBeenCalled();
  });

  it('should register an exposed component added by a core Grafana in dev-mode even if the meta-info is missing', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new ExposedComponentsRegistry();
    const componentConfig = {
      id: `${pluginId}/exposed-component/v1`,
      title: 'Component title',
      description: 'Component description',
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

  it('should register an exposed component added by a plugin in production mode even if the meta-info is missing', async () => {
    // Production mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);

    const registry = new ExposedComponentsRegistry();
    const componentConfig = {
      id: `${pluginId}/exposed-component/v1`,
      title: 'Component title',
      description: 'Component description',
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.exposedComponents = [];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });

  it('should register an exposed component added by a plugin in dev-mode if the meta-info is present', async () => {
    // Enabling dev mode
    jest.mocked(isGrafanaDevMode).mockReturnValue(true);

    const registry = new ExposedComponentsRegistry();
    const componentConfig = {
      id: `${pluginId}/exposed-component/v1`,
      title: 'Component title',
      description: 'Component description',
      component: () => React.createElement('div', null, 'Hello World1'),
    };

    // Make sure that the meta-info is empty
    config.apps[pluginId].extensions.exposedComponents = [componentConfig];

    registry.register({
      pluginId,
      configs: [componentConfig],
    });

    const currentState = await registry.getState();

    expect(Object.keys(currentState)).toHaveLength(1);
    expect(log.error).not.toHaveBeenCalled();
  });
});
