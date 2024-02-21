// import { PluginExtensionLinkConfig, PluginExtensionTypes } from '@grafana/data';

import { firstValueFrom } from 'rxjs';

import { PluginExtensionTypes } from '@grafana/data';

import { ReactivePluginExtenionRegistry } from './reactivePluginExtensionRegistry';

describe('createPluginExtensionsRegistry', () => {
  it('should return empty registry when no extensions registered', async () => {
    const reactiveRegistry = new ReactivePluginExtenionRegistry();
    const observable = reactiveRegistry.asObservable();
    const registry = await firstValueFrom(observable);
    expect(registry).toEqual({});
  });

  it('should be possible to register extensions in the registry', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new ReactivePluginExtenionRegistry();

    reactiveRegistry.registerPlugin({
      pluginId,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
        {
          type: PluginExtensionTypes.link,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockImplementation((context) => ({ title: context?.title })),
        },
      ],
    });

    const registry = await reactiveRegistry.getRegistry();

    expect(registry).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 1',
            description: 'Link 1 description',
            path: `/a/${pluginId}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 2',
            description: 'Link 2 description',
            path: `/a/${pluginId}/declare-incident`,
            extensionPointId: 'plugins/myorg-basic-app/start',
            configure: expect.any(Function),
          },
        },
      ],
    });
  });

  it('should be possible to asynchronously register extensions for the same placement (different plugins)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new ReactivePluginExtenionRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.registerPlugin({
      pluginId: pluginId1,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getRegistry();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 1',
            description: 'Link 1 description',
            path: `/a/${pluginId1}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.registerPlugin({
      pluginId: pluginId2,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getRegistry();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 1',
            description: 'Link 1 description',
            path: `/a/${pluginId1}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
        {
          pluginId: pluginId2,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 2',
            description: 'Link 2 description',
            path: `/a/${pluginId2}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
      ],
    });
  });

  it('should be possible to asynchronously register extensions for a different placement (different plugin)', async () => {
    const pluginId1 = 'grafana-basic-app';
    const pluginId2 = 'grafana-basic-app2';
    const reactiveRegistry = new ReactivePluginExtenionRegistry();

    // Register extensions for the first plugin
    reactiveRegistry.registerPlugin({
      pluginId: pluginId1,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId1}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry1 = await reactiveRegistry.getRegistry();

    expect(registry1).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 1',
            description: 'Link 1 description',
            path: `/a/${pluginId1}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
      ],
    });

    // Register extensions for the second plugin to a different placement
    reactiveRegistry.registerPlugin({
      pluginId: pluginId2,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 2',
          description: 'Link 2 description',
          path: `/a/${pluginId2}/declare-incident`,
          extensionPointId: 'plugins/myorg-basic-app/start',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    const registry2 = await reactiveRegistry.getRegistry();

    expect(registry2).toEqual({
      'grafana/dashboard/panel/menu': [
        {
          pluginId: pluginId1,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 1',
            description: 'Link 1 description',
            path: `/a/${pluginId1}/declare-incident`,
            extensionPointId: 'grafana/dashboard/panel/menu',
            configure: expect.any(Function),
          },
        },
      ],
      'plugins/myorg-basic-app/start': [
        {
          pluginId: pluginId2,
          config: {
            type: PluginExtensionTypes.link,
            title: 'Link 2',
            description: 'Link 2 description',
            path: `/a/${pluginId2}/declare-incident`,
            extensionPointId: 'plugins/myorg-basic-app/start',
            configure: expect.any(Function),
          },
        },
      ],
    });
  });

  it('should be possible to asynchronously register extensions for the same placement (same plugin)', async () => {});
  
  it('should be possible to asynchronously register extensions for a different placement (same plugin)', async () => {});

  it('should notify subscribers when the registry changes', async () => {
    const pluginId = 'grafana-basic-app';
    const reactiveRegistry = new ReactivePluginExtenionRegistry();
    const observable = reactiveRegistry.asObservable();
    const subscribeCallback = jest.fn();

    observable.subscribe(subscribeCallback);

    // Register extensions for the first plugin
    reactiveRegistry.registerPlugin({
      pluginId: pluginId,
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(2);

    // Register extensions for the first plugin
    reactiveRegistry.registerPlugin({
      pluginId: 'another-plugin',
      extensionConfigs: [
        {
          type: PluginExtensionTypes.link,
          title: 'Link 1',
          description: 'Link 1 description',
          path: `/a/${pluginId}/declare-incident`,
          extensionPointId: 'grafana/dashboard/panel/menu',
          configure: jest.fn().mockReturnValue({}),
        },
      ],
    });

    expect(subscribeCallback).toHaveBeenCalledTimes(3);
  });

  it('should give the last version of the registry for new subscribers', async () => {});

  it('should not register extensions for a plugin that had errors', () => {});

  it('should not register an extension if it has an invalid configure() function', () => {});

  it('should not register an extension if it has invalid properties (empty title / description)', () => {});

  it('should not register link extensions with invalid path configured', () => {});
});

// describe('createRegistry()', () => {
//   const placement1 = 'grafana/dashboard/panel/menu';
//   const placement2 = 'plugins/myorg-basic-app/start';
//   const pluginId = 'grafana-basic-app';
//   let link1: PluginExtensionLinkConfig, link2: PluginExtensionLinkConfig;

//   beforeEach(() => {
//     link1 = {
//       type: PluginExtensionTypes.link,
//       title: 'Link 1',
//       description: 'Link 1 description',
//       path: `/a/${pluginId}/declare-incident`,
//       extensionPointId: placement1,
//       configure: jest.fn().mockReturnValue({}),
//     };
//     link2 = {
//       type: PluginExtensionTypes.link,
//       title: 'Link 2',
//       description: 'Link 2 description',
//       path: `/a/${pluginId}/declare-incident`,
//       extensionPointId: placement2,
//       configure: jest.fn().mockImplementation((context) => ({ title: context?.title })),
//     };

//     global.console.warn = jest.fn();
//   });

//   it('should be possible to register extensions', () => {
//     const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link1, link2] }]);

//     expect(Object.getOwnPropertyNames(registry)).toEqual([placement1, placement2]);

//     // Placement 1
//     expect(registry[placement1]).toHaveLength(1);
//     expect(registry[placement1]).toEqual(
//       expect.arrayContaining([
//         expect.objectContaining({
//           pluginId,
//           config: {
//             ...link1,
//             configure: expect.any(Function),
//           },
//         }),
//       ])
//     );

//     // Placement 2
//     expect(registry[placement2]).toHaveLength(1);
//     expect(registry[placement2]).toEqual(
//       expect.arrayContaining([
//         expect.objectContaining({
//           pluginId,
//           config: {
//             ...link2,
//             configure: expect.any(Function),
//           },
//         }),
//       ])
//     );
//   });

//   it('should not register link extensions with invalid path configured', () => {
//     const registry = createPluginExtensionRegistry([
//       { pluginId, extensionConfigs: [{ ...link1, path: 'invalid-path' }, link2] },
//     ]);

//     expect(Object.getOwnPropertyNames(registry)).toEqual([placement2]);

//     // Placement 2
//     expect(registry[placement2]).toHaveLength(1);
//     expect(registry[placement2]).toEqual(
//       expect.arrayContaining([
//         expect.objectContaining({
//           pluginId,
//           config: {
//             ...link2,
//             configure: expect.any(Function),
//           },
//         }),
//       ])
//     );
//   });

//   it('should not register extensions for a plugin that had errors', () => {
//     const registry = createPluginExtensionRegistry([
//       { pluginId, extensionConfigs: [link1, link2], error: new Error('Plugin failed to load') },
//     ]);

//     expect(Object.getOwnPropertyNames(registry)).toEqual([]);
//   });

//   it('should not register an extension if it has an invalid configure() function', () => {
//     const registry = createPluginExtensionRegistry([
//       // @ts-ignore (We would like to provide an invalid configure function on purpose)
//       { pluginId, extensionConfigs: [{ ...link1, configure: '...' }, link2] },
//     ]);

//     expect(Object.getOwnPropertyNames(registry)).toEqual([placement2]);

//     // Placement 2 (checking if it still registers the extension with a valid configuration)
//     expect(registry[placement2]).toHaveLength(1);
//     expect(registry[placement2]).toEqual(
//       expect.arrayContaining([
//         expect.objectContaining({
//           pluginId,
//           config: {
//             ...link2,
//             configure: expect.any(Function),
//           },
//         }),
//       ])
//     );
//   });

//   it('should not register an extension if it has invalid properties (empty title / description)', () => {
//     const registry = createPluginExtensionRegistry([
//       { pluginId, extensionConfigs: [{ ...link1, title: '', description: '' }, link2] },
//     ]);

//     expect(Object.getOwnPropertyNames(registry)).toEqual([placement2]);

//     // Placement 2 (checking if it still registers the extension with a valid configuration)
//     expect(registry[placement2]).toHaveLength(1);
//     expect(registry[placement2]).toEqual(
//       expect.arrayContaining([
//         expect.objectContaining({
//           pluginId,
//           config: {
//             ...link2,
//             configure: expect.any(Function),
//           },
//         }),
//       ])
//     );
//   });
// });
