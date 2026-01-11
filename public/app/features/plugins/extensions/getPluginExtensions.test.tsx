import * as React from 'react';
import { first, lastValueFrom, Observable, take, takeUntil, timer } from 'rxjs';

import {
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionAddedComponentConfig,
  PluginExtensionLink,
  PluginExtensionTypes,
  PluginExtension,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import {
  getObservablePluginComponents,
  getObservablePluginExtensions,
  getObservablePluginLinks,
  getPluginExtensions,
} from './getPluginExtensions';
import { log } from './logs/log';
import { resetLogMock } from './logs/testUtils';
import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { pluginExtensionRegistries } from './registry/setup';
import { isReadOnlyProxy } from './utils';
import { assertPluginExtensionLink } from './validators';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

jest.mock('./logs/log', () => {
  const { createLogMock } = jest.requireActual('./logs/testUtils');
  const original = jest.requireActual('./logs/log');

  return {
    ...original,
    log: createLogMock(),
  };
});

async function createRegistries(
  preloadResults: Array<{
    pluginId: string;
    addedComponentConfigs: PluginExtensionAddedComponentConfig[];
    addedLinkConfigs: PluginExtensionAddedLinkConfig[];
  }>
) {
  const addedLinksRegistry = new AddedLinksRegistry();
  const addedComponentsRegistry = new AddedComponentsRegistry();

  for (const { pluginId, addedLinkConfigs, addedComponentConfigs } of preloadResults) {
    addedLinksRegistry.register({
      pluginId,
      configs: addedLinkConfigs,
    });
    addedComponentsRegistry.register({
      pluginId,
      configs: addedComponentConfigs,
    });
  }

  return {
    addedLinksRegistry,
    addedComponentsRegistry,
  };
}

function getLastEmittedValue<T = { extensions: PluginExtension[] }>(observable: Observable<T>) {
  return lastValueFrom(observable.pipe(takeUntil(timer(100))));
}

describe('getPluginExtensions()', () => {
  const extensionPoint1 = 'grafana/dashboard/panel/menu/v1';
  const extensionPoint2 = 'plugins/myorg-basic-app/start/v1';
  const extensionPoint3 = 'grafana/datasources/config/v1';
  const pluginId = 'grafana-basic-app';
  // Sample extension configs that are used in the tests below
  let link1: PluginExtensionAddedLinkConfig;
  let link2: PluginExtensionAddedLinkConfig;
  let component1: PluginExtensionAddedComponentConfig;

  beforeEach(() => {
    link1 = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/${pluginId}/declare-incident`,
      targets: extensionPoint1,
      configure: jest.fn().mockReturnValue({}),
    };
    link2 = {
      title: 'Link 2',
      description: 'Link 2 description',
      path: `/a/${pluginId}/declare-incident`,
      targets: extensionPoint2,
      configure: jest.fn().mockImplementation((context) => ({ title: context?.title })),
    };
    component1 = {
      title: 'Component 1',
      description: 'Component 1 description',
      targets: extensionPoint3,
      component: (context) => {
        return <div>Hello world!</div>;
      },
    };

    jest.mocked(reportInteraction).mockReset();
    resetLogMock(log);
  });

  test('should return the extensions for the given placement', async () => {
    const registries = await createRegistries([
      { pluginId, addedLinkConfigs: [link1, link2], addedComponentConfigs: [] },
    ]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint1,
      })
    );

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        title: link1.title,
        description: link1.description,
        path: expect.stringContaining(link1.path!),
      })
    );
  });

  test('should not limit the number of extensions per plugin by default', async () => {
    // Registering 3 extensions for the same plugin for the same placement
    const registries = await createRegistries([
      {
        pluginId,
        addedLinkConfigs: [link1, link1, link1, link2],
        addedComponentConfigs: [],
      },
    ]);

    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint1,
      })
    );

    expect(extensions).toHaveLength(3);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        title: link1.title,
        description: link1.description,
        path: expect.stringContaining(link1.path!),
      })
    );
    // });
  });

  test('should be possible to limit the number of extensions per plugin for a given placement', async () => {
    const registries = await createRegistries([
      { pluginId, addedLinkConfigs: [link1, link1, link1, link2], addedComponentConfigs: [] },
      {
        pluginId: 'my-plugin',
        addedComponentConfigs: [],
        addedLinkConfigs: [
          { ...link1, path: '/a/my-plugin/declare-incident' },
          { ...link1, path: '/a/my-plugin/declare-incident' },
          { ...link1, path: '/a/my-plugin/declare-incident' },
          { ...link2, path: '/a/my-plugin/declare-incident' },
        ],
      },
    ]);

    // Limit to 1 extension per plugin
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint1,
        limitPerPlugin: 1,
      })
    );

    expect(extensions).toHaveLength(2);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        title: link1.title,
        description: link1.description,
        path: expect.stringContaining(link1.path!),
      })
    );
  });

  test('should return with an empty list if there are no extensions registered for a placement yet', async () => {
    const registries = await createRegistries([
      { pluginId, addedLinkConfigs: [link1, link2], addedComponentConfigs: [] },
    ]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: 'placement-with-no-extensions',
      })
    );

    expect(extensions).toEqual([]);
  });

  test('should pass the context to the configure() function', async () => {
    const context = { title: 'New title from the context!' };
    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);

    await getLastEmittedValue(getPluginExtensions({ ...registries, context, extensionPointId: extensionPoint2 }));

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(link2.configure).toHaveBeenCalledWith(context);
  });

  test('should be possible to update the basic properties with the configure() function', async () => {
    link2.configure = jest.fn().mockImplementation(() => ({
      title: 'Updated title',
      description: 'Updated description',
      path: `/a/${pluginId}/updated-path`,
      icon: 'search',
      category: 'Machine Learning',
    }));

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint2,
      })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(extension.title).toBe('Updated title');
    expect(extension.description).toBe('Updated description');
    expect(extension.path?.startsWith(`/a/${pluginId}/updated-path`)).toBeTruthy();
    expect(extension.icon).toBe('search');
    expect(extension.category).toBe('Machine Learning');
  });

  test('should append link tracking to path when running configure() function', async () => {
    link2.configure = jest.fn().mockImplementation(() => ({
      title: 'Updated title',
      description: 'Updated description',
      path: `/a/${pluginId}/updated-path`,
      icon: 'search',
      category: 'Machine Learning',
    }));

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint2,
      })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(extension.path).toBe(
      `/a/${pluginId}/updated-path?uel_pid=grafana-basic-app&uel_epid=plugins%2Fmyorg-basic-app%2Fstart%2Fv1`
    );
  });

  test('should ignore restricted properties passed via the configure() function', async () => {
    link2.configure = jest.fn().mockImplementation(() => ({
      // The following props are not allowed to override
      type: 'unknown-type',
      pluginId: 'another-plugin',

      // Unknown properties
      testing: false,

      // The following props are allowed to override
      title: 'test',
    }));

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: extensionPoint2,
      })
    );
    const [extension] = extensions;

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(extensions).toHaveLength(1);
    expect(extension.title).toBe('test');
    expect(extension.type).toBe('link');
    expect(extension.pluginId).toBe('grafana-basic-app');
    //@ts-ignore
    expect(extension.testing).toBeUndefined();
  });
  test('should pass a read only context to the configure() function', async () => {
    const context = { title: 'New title from the context!' };
    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        context,
        extensionPointId: extensionPoint2,
      })
    );
    const [extension] = extensions;
    const readOnlyContext = (link2.configure as jest.Mock).mock.calls[0][0];

    assertPluginExtensionLink(extension);

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(isReadOnlyProxy(readOnlyContext)).toBe(true);
    expect(() => {
      readOnlyContext.title = 'New title';
    }).toThrow();
    expect(context.title).toBe('New title from the context!');
  });

  test('should catch errors in the configure() function and log them as error', async () => {
    link2.configure = jest.fn().mockImplementation(() => {
      throw new Error('Something went wrong!');
    });

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);

    expect(async () => {
      await getLastEmittedValue(getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 }));
    }).not.toThrow();

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith('Failed to configure link with title "Link 2"', {
      message: 'Something went wrong!',
      stack: expect.stringContaining('Error: Something went wrong!'),
    });
  });

  test('should skip the extension if any of the updated props returned by the configure() function are invalid', async () => {
    const overrides = {
      title: '', // Invalid empty string for title - should be ignored
      description: 'A valid description.', // This should be updated
    };

    link2.configure = jest.fn().mockImplementation(() => overrides);

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );

    expect(extensions).toHaveLength(0);
    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('should not skip the extension if the configure() function returns a promise', async () => {
    link2.configure = jest.fn().mockImplementation(() => Promise.resolve({}));

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );

    expect(extensions).toHaveLength(1);
    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(0);
  });

  test('should skip (hide) the extension if the configure() function returns undefined', async () => {
    link2.configure = jest.fn().mockImplementation(() => undefined);

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );

    expect(extensions).toHaveLength(0);
    expect(log.warning).toHaveBeenCalledTimes(0); // As this is intentional, no warning should be logged
  });

  test('should pass event, context and helper to extension onClick()', async () => {
    link2.path = undefined;
    link2.onClick = jest.fn().mockImplementation(() => {
      throw new Error('Something went wrong!');
    });

    const context = {};
    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    const event = {} as React.MouseEvent;
    extension.onClick?.(event);

    expect(link2.onClick).toHaveBeenCalledTimes(1);
    expect(link2.onClick).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        context,
        openModal: expect.any(Function),
        extensionPointId: extensionPoint2,
      })
    );
  });

  test('should catch errors in async/promise-based onClick function and log them as errors', async () => {
    link2.path = undefined;
    link2.onClick = jest.fn().mockRejectedValue(new Error('testing'));

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    await extension.onClick?.({} as React.MouseEvent);

    expect(extensions).toHaveLength(1);
    expect(link2.onClick).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('should catch errors in the onClick() function and log them as errors', async () => {
    link2.path = undefined;
    link2.onClick = jest.fn().mockImplementation(() => {
      throw new Error('Something went wrong!');
    });

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint2 })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);
    extension.onClick?.({} as React.MouseEvent);

    expect(link2.onClick).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith('Something went wrong!', {
      message: 'Something went wrong!',
      stack: expect.stringContaining('Error: Something went wrong!'),
    });
  });

  test('should pass a read only context to the onClick() function', async () => {
    const context = { title: 'New title from the context!' };

    link2.path = undefined;
    link2.onClick = jest.fn();

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, context, extensionPointId: extensionPoint2 })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);
    extension.onClick?.({} as React.MouseEvent);

    const helpers = (link2.onClick as jest.Mock).mock.calls[0][1];

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(isReadOnlyProxy(helpers.context)).toBe(true);
    expect(() => {
      helpers.context.title = 'New title';
    }).toThrow();
  });

  test('should not make original context read only', async () => {
    const context = {
      title: 'New title from the context!',
      nested: { title: 'title' },
      array: ['a'],
    };

    const registries = await createRegistries([{ pluginId, addedLinkConfigs: [link2], addedComponentConfigs: [] }]);
    getPluginExtensions({ ...registries, context, extensionPointId: extensionPoint2 });

    expect(() => {
      context.title = 'Updating the title';
      context.nested.title = 'new title';
      context.array.push('b');
    }).not.toThrow();
  });

  test('should report interaction when onClick is triggered', async () => {
    const reportInteractionMock = jest.mocked(reportInteraction);

    const registries = await createRegistries([
      {
        pluginId,
        addedLinkConfigs: [
          {
            ...link1,
            path: undefined,
            onClick: jest.fn(),
          },
        ],
        addedComponentConfigs: [],
      },
    ]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({ ...registries, extensionPointId: extensionPoint1 })
    );
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    extension.onClick?.();

    expect(reportInteractionMock).toBeCalledTimes(1);
    expect(reportInteractionMock).toBeCalledWith('ui_extension_link_clicked', {
      pluginId: extension.pluginId,
      extensionPointId: extensionPoint1,
      title: extension.title,
      category: extension.category,
    });
  });

  test('should be possible to register and get component type extensions', async () => {
    const registries = await createRegistries([
      {
        pluginId,
        addedLinkConfigs: [],
        addedComponentConfigs: [component1],
      },
    ]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        extensionPointId: Array.isArray(component1.targets) ? component1.targets[0] : component1.targets,
      })
    );

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        title: component1.title,
        description: component1.description,
      })
    );
  });

  test('should honour the limitPerPlugin also for component extensions', async () => {
    const registries = await createRegistries([
      {
        pluginId,
        addedLinkConfigs: [],
        addedComponentConfigs: [
          component1,
          {
            title: 'Component 2',
            description: 'Component 2 description',
            targets: component1.targets,
            component: (context) => {
              return <div>Hello world2!</div>;
            },
          },
        ],
      },
    ]);
    const { extensions } = await getLastEmittedValue(
      getPluginExtensions({
        ...registries,
        limitPerPlugin: 1,
        extensionPointId: Array.isArray(component1.targets) ? component1.targets[0] : component1.targets,
      })
    );

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        title: component1.title,
        description: component1.description,
      })
    );
  });
});

describe('getObservablePluginExtensions()', () => {
  const extensionPointId = 'grafana/dashboard/panel/menu/v1';
  const pluginId = 'grafana-basic-app';

  beforeEach(() => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();
    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    pluginExtensionRegistries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Component 1',
          description: 'Component 1 description',
          targets: extensionPointId,
          component: () => {
            return <div>Hello world!</div>;
          },
        },
      ],
    });
  });

  it('should emit the initial state when no changes are made to the registries', async () => {
    const observable = getObservablePluginExtensions({ extensionPointId }).pipe(takeUntil(timer(10)));

    await expect(observable).toEmitValuesWith((received) => {
      const { extensions } = received[received.length - 1];
      expect(extensions).toHaveLength(2);
      expect(extensions[0].pluginId).toBe(pluginId);
      expect(extensions[1].pluginId).toBe(pluginId);
    });
  });

  it('should emit the new state when the registries change', async () => {
    const observable = getObservablePluginExtensions({ extensionPointId }).pipe(takeUntil(timer(10)));

    setTimeout(() => {
      pluginExtensionRegistries.addedLinksRegistry.register({
        pluginId,
        configs: [
          {
            title: 'Link 2',
            description: 'Link 2 description',
            path: `/a/${pluginId}/declare-incident`,
            targets: extensionPointId,
            configure: jest.fn().mockReturnValue({}),
          },
        ],
      });
    }, 0);

    await expect(observable).toEmitValuesWith((received) => {
      const { extensions } = received[1];
      expect(extensions).toHaveLength(2);
      expect(extensions[0].pluginId).toBe(pluginId);
      expect(extensions[1].pluginId).toBe(pluginId);

      const { extensions: extensions2 } = received[received.length - 1];
      expect(extensions2).toHaveLength(3);
      expect(extensions2[0].pluginId).toBe(pluginId);
      expect(extensions2[1].pluginId).toBe(pluginId);
      expect(extensions2[2].pluginId).toBe(pluginId);
    });
  });
});

describe('getObservablePluginLinks()', () => {
  const extensionPointId = 'grafana/dashboard/panel/menu/v1';
  const pluginId = 'grafana-basic-app';

  beforeEach(() => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();
    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    pluginExtensionRegistries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Component 1',
          description: 'Component 1 description',
          targets: extensionPointId,
          component: () => {
            return <div>Hello world!</div>;
          },
        },
      ],
    });
  });

  it('should only emit the links', async () => {
    const observable = getObservablePluginLinks({ extensionPointId }).pipe(first());

    await expect(observable).toEmitValuesWith((received) => {
      const links = received[0];
      expect(links).toHaveLength(1);
      expect(links[0].pluginId).toBe(pluginId);
      expect(links[0].type).toBe(PluginExtensionTypes.link);
    });
  });

  it('should be possible to get the last value from the observable', async () => {
    const observable = getObservablePluginLinks({ extensionPointId });
    const links = await getLastEmittedValue(observable);

    expect(links).toHaveLength(1);
    expect(links[0].pluginId).toBe(pluginId);
    expect(links[0].type).toBe(PluginExtensionTypes.link);
  });

  it('should be possible to receive the last state of the registry', async () => {
    // Register a new link
    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const observable = getObservablePluginLinks({ extensionPointId });
    const links = await getLastEmittedValue(observable);

    expect(links).toHaveLength(2);
    expect(links[0].pluginId).toBe(pluginId);
    expect(links[0].type).toBe(PluginExtensionTypes.link);
    expect(links[1].pluginId).toBe(pluginId);
    expect(links[1].type).toBe(PluginExtensionTypes.link);
  });

  it('should emit static links immediately and then emit again as async configure() functions resolve', async () => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();

    const staticLinkPromise = new Promise<{ title: string }>((resolve) =>
      setTimeout(() => resolve({ title: 'Updated Async' }), 50)
    );

    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Static Link',
          description: 'Static Description',
          path: `/a/${pluginId}/static`,
          targets: extensionPointId,
          // No configure function - should appear immediately
        },
        {
          title: 'Async Link',
          description: 'Async Description',
          path: `/a/${pluginId}/async`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue(staticLinkPromise),
        },
      ],
    });

    const observable = getObservablePluginLinks({ extensionPointId });
    const emittedValues: PluginExtensionLink[][] = [];

    const subscription = observable.subscribe((links) => {
      emittedValues.push([...links]);
    });

    // Wait for initial emission (should include static link)
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(emittedValues.length).toBeGreaterThanOrEqual(1);
    const firstEmission = emittedValues[0];
    expect(firstEmission.length).toBeGreaterThanOrEqual(1);
    const staticLink = firstEmission.find((link) => link.title === 'Static Link');
    expect(staticLink).toBeDefined();

    // Wait for async configure to resolve
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have emitted again with the async link
    expect(emittedValues.length).toBeGreaterThanOrEqual(2);
    const lastEmission = emittedValues[emittedValues.length - 1];
    expect(lastEmission.length).toBe(2);
    const asyncLink = lastEmission.find((link) => link.title === 'Updated Async');
    expect(asyncLink).toBeDefined();

    subscription.unsubscribe();
  });

  it('should emit the links with a sync configure() function first', async () => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();

    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Sync Link',
          description: 'Sync Description',
          path: `/a/${pluginId}/sync`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({ title: 'Sync Link (updated)' }),
        },
        {
          title: 'Async Link',
          description: 'Async Description',
          path: `/a/${pluginId}/async`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue(Promise.resolve({ title: 'Async Link (updated)' })),
        },
      ],
    });

    await expect(getObservablePluginLinks({ extensionPointId }).pipe(take(2))).toEmitValuesWith((received) => {
      expect(received.length).toBe(2);

      const links1 = received[0];
      expect(links1).toHaveLength(1);
      expect(links1[0].title).toBe('Sync Link (updated)');

      const links2 = received[1];
      expect(links2).toHaveLength(2);
      expect(links2[0].title).toBe('Sync Link (updated)');
      expect(links2[1].title).toBe('Async Link (updated)');
    });
  });

  it('should emit incrementally as multiple async configure() functions resolve at different times', async () => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();

    const fastConfigure = new Promise<{ title: string }>((resolve) =>
      setTimeout(() => resolve({ title: 'Fast Link (updated)' }), 20)
    );
    const slowConfigure = new Promise<{ title: string }>((resolve) =>
      setTimeout(() => resolve({ title: 'Slow Link (updated)' }), 80)
    );

    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Static Link', // no dynamic behaviour = no configure() function
          description: 'Static Description',
          path: `/a/${pluginId}/static`,
          targets: extensionPointId,
        },
        {
          title: 'Sync Link',
          description: 'Sync Description',
          path: `/a/${pluginId}/sync`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({ title: 'Sync Link (updated)' }),
        },
        {
          title: 'Fast Link',
          description: 'Fast Description',
          path: `/a/${pluginId}/fast`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue(fastConfigure),
        },
        {
          title: 'Slow Link',
          description: 'Slow Description',
          path: `/a/${pluginId}/slow`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue(slowConfigure),
        },
      ],
    });

    await expect(getObservablePluginLinks({ extensionPointId }).pipe(take(4))).toEmitValuesWith((received) => {
      expect(received.length).toBe(4);

      const links0 = received[0];
      expect(links0).toHaveLength(1);
      expect(links0[0].title).toBe('Static Link');

      const links1 = received[1];
      expect(links1).toHaveLength(2);
      expect(links1[0].title).toBe('Static Link');
      expect(links1[1].title).toBe('Sync Link (updated)');

      const links2 = received[2];
      expect(links2).toHaveLength(3);
      expect(links2[0].title).toBe('Static Link');
      expect(links2[1].title).toBe('Sync Link (updated)');
      expect(links2[2].title).toBe('Fast Link (updated)');

      const links3 = received[3];
      expect(links3).toHaveLength(4);
      expect(links3[0].title).toBe('Static Link');
      expect(links3[1].title).toBe('Sync Link (updated)');
      expect(links3[2].title).toBe('Fast Link (updated)');
      expect(links3[3].title).toBe('Slow Link (updated)');
    });
  });

  it('should handle buggy async configure() functions that never resolve without blocking', async () => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();

    const buggyPromise = new Promise(() => {
      // Never resolves - simulating a buggy implementation
    });

    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Static Link',
          description: 'Static Description',
          path: `/a/${pluginId}/static`,
          targets: extensionPointId,
        },
        {
          title: 'Buggy Async Link',
          description: 'Buggy Description',
          path: `/a/${pluginId}/buggy`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue(buggyPromise),
        },
      ],
    });

    const observable = getObservablePluginLinks({ extensionPointId });
    const emittedValues: PluginExtensionLink[][] = [];

    const subscription = observable.subscribe((links) => {
      emittedValues.push([...links]);
    });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have emitted initial value with static link
    expect(emittedValues.length).toBeGreaterThanOrEqual(1);
    const firstEmission = emittedValues[0];
    expect(firstEmission.length).toBe(1);
    expect(firstEmission[0].title).toBe('Static Link');

    // Buggy link should never appear
    const hasBuggyLink = emittedValues.some((emission) => emission.some((link) => link.title === 'Buggy Async Link'));
    expect(hasBuggyLink).toBe(false);

    subscription.unsubscribe();
  });
});

describe('getObservablePluginComponents()', () => {
  const extensionPointId = 'grafana/dashboard/panel/menu/v1';
  const pluginId = 'grafana-basic-app';

  beforeEach(() => {
    pluginExtensionRegistries.addedLinksRegistry = new AddedLinksRegistry();
    pluginExtensionRegistries.addedComponentsRegistry = new AddedComponentsRegistry();
    pluginExtensionRegistries.addedLinksRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          targets: extensionPointId,
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    pluginExtensionRegistries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Component 1',
          description: 'Component 1 description',
          targets: extensionPointId,
          component: () => {
            return <div>Hello world!</div>;
          },
        },
      ],
    });
  });

  it('should only emit the components', async () => {
    const observable = getObservablePluginComponents({ extensionPointId }).pipe(first());

    await expect(observable).toEmitValuesWith((received) => {
      const components = received[0];
      expect(components).toHaveLength(1);
      expect(components[0].pluginId).toBe(pluginId);
      expect(components[0].type).toBe(PluginExtensionTypes.component);
    });
  });

  it('should be possible to get the last value from the observable', async () => {
    const observable = getObservablePluginComponents({ extensionPointId });
    const components = await getLastEmittedValue(observable);

    expect(components).toHaveLength(1);
    expect(components[0].pluginId).toBe(pluginId);
    expect(components[0].type).toBe(PluginExtensionTypes.component);
  });

  it('should be possible to receive the last state of the registry', async () => {
    // Register a new component
    pluginExtensionRegistries.addedComponentsRegistry.register({
      pluginId,
      configs: [
        {
          title: 'Component 2',
          description: 'Component 2 description',
          targets: extensionPointId,
          component: () => {
            return <div>Hello world2!</div>;
          },
        },
      ],
    });

    const observable = getObservablePluginComponents({ extensionPointId });
    const components = await getLastEmittedValue(observable);

    expect(components).toHaveLength(2);
    expect(components[0].pluginId).toBe(pluginId);
    expect(components[0].type).toBe(PluginExtensionTypes.component);
    expect(components[1].pluginId).toBe(pluginId);
    expect(components[1].type).toBe(PluginExtensionTypes.component);
  });
});
