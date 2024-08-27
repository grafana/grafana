import React from 'react';
import { firstValueFrom } from 'rxjs';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';

describe('AddedComponentsRegistry', () => {
  const consoleWarn = jest.fn();

  beforeEach(() => {
    global.console.warn = consoleWarn;
    consoleWarn.mockReset();
  });

  it('should return empty registry when no extensions registered', async () => {
    const reactiveRegistry = new AddedComponentsRegistry();
    const observable = reactiveRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register added components in the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const id = `${pluginId}/hello-world/v1`;
    const reactiveRegistry = new AddedComponentsRegistry();

    reactiveRegistry.register({
      pluginId,
      configs: [
        {
          targets: [id],
          title: 'not important',
          description: 'not important',
          component: () => React.createElement('div', null, 'Hello World'),
        },
      ],
    });

    const registry = await reactiveRegistry.getState();

    expect(Object.keys(registry)).toHaveLength(1);
    expect(registry[id][0]).toMatchObject({
      pluginId,
      title: 'not important',
      description: 'not important',
    });
  });
  it('should be possible to asynchronously register component extensions for the same extension point (different plugins)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
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
    expect(registry1['grafana/alerting/home'][0]).toMatchObject({
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
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();
    expect(Object.keys(registry2)).toHaveLength(1);
    expect(registry2['grafana/alerting/home']).toEqual(
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
    expect(registry1).toEqual({
      'grafana/alerting/home': expect.arrayContaining([
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
          targets: ['grafana/user/profile/tab'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getState();

    expect(registry2).toEqual({
      'grafana/alerting/home': expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      'grafana/user/profile/tab': expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId2,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ]),
    });
  });

  it('should be possible to asynchronously register component extensions for the same extension point (same plugin)', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedComponentsRegistry();

    // Register extensions for the first extension point
    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
        {
          title: 'Component 2 title',
          description: 'Component 2 description',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World2'),
        },
      ],
    });
    const registry1 = await reactiveRegistry.getState();
    expect(registry1).toEqual({
      'grafana/alerting/home': expect.arrayContaining([
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
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new AddedComponentsRegistry();

    reactiveRegistry.register({
      pluginId: pluginId,
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['grafana/alerting/home', 'grafana/user/profile/tab'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });
    const registry1 = await reactiveRegistry.getState();
    expect(registry1).toEqual({
      'grafana/alerting/home': expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      'grafana/user/profile/tab': expect.arrayContaining([
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
    const pluginId2 = 'another-plugin';
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
          targets: ['grafana/alerting/home'],
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
          targets: ['grafana/user/profile/tab'],
          component: () => React.createElement('div', null, 'Hello World2'),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);

    const registry = subscribeCallback.mock.calls[2][0];

    expect(registry).toEqual({
      'grafana/alerting/home': expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId1,
          title: 'Component 1 title',
          description: 'Component 1 description',
        }),
      ]),
      'grafana/user/profile/tab': expect.arrayContaining([
        expect.objectContaining({
          pluginId: pluginId2,
          title: 'Component 2 title',
          description: 'Component 2 description',
        }),
      ]),
    });
  });

  it('should skip registering component and log a warning when id is not prefixed with plugin id or grafana', async () => {
    const registry = new AddedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      "[Plugin Extensions] Could not register added component with id 'alerting/home'. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id or grafana. e.g '<grafana|myorg-basic-app>/my-component-id/v1'."
    );
    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should log a warning when exposed component id is not suffixed with component version', async () => {
    const registry = new AddedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          title: 'Component 1 title',
          description: 'Component 1 description',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      "[Plugin Extensions] Added component with id 'grafana/alerting/home' does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'."
    );
    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(1);
  });

  it('should not register component when description is missing', async () => {
    const registry = new AddedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          title: 'Component 1 title',
          description: '',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      "[Plugin Extensions] Could not register added component with title 'Component 1 title'. Reason: Description is missing."
    );
    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });

  it('should not register component when title is missing', async () => {
    const registry = new AddedComponentsRegistry();
    registry.register({
      pluginId: 'grafana-basic-app',
      configs: [
        {
          title: 'Component 1 title',
          description: '',
          targets: ['grafana/alerting/home'],
          component: () => React.createElement('div', null, 'Hello World1'),
        },
      ],
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      "[Plugin Extensions] Could not register added component with title 'Component 1 title'. Reason: Description is missing."
    );

    const currentState = await registry.getState();
    expect(Object.keys(currentState)).toHaveLength(0);
  });
});
