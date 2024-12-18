import { renderHook } from '@testing-library/react';

import { PluginExtension, PluginExtensionTypes } from '@grafana/data';

import { UsePluginExtensions } from './getPluginExtensions';
import {
  setPluginExtensionsHook,
  usePluginComponentExtensions,
  usePluginExtensions,
  usePluginLinkExtensions,
} from './usePluginExtensions';

describe('Plugin Extensions / usePluginExtensions', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  test('should always return the same extension-hook function that was previously set', () => {
    const hook: UsePluginExtensions = jest.fn().mockReturnValue({ extensions: [], isLoading: false });

    setPluginExtensionsHook(hook);
    usePluginExtensions({ extensionPointId: 'panel-menu' });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith({ extensionPointId: 'panel-menu' });
  });

  test('should throw an error when trying to redefine the app-wide extension-hook function', () => {
    // By default, NODE_ENV is set to 'test' in jest.config.js, which allows to override the registry in tests.
    process.env.NODE_ENV = 'production';

    const hook: UsePluginExtensions = () => ({ extensions: [], isLoading: false });

    expect(() => {
      setPluginExtensionsHook(hook);
      setPluginExtensionsHook(hook);
    }).toThrow();
  });

  test('should throw an error when trying to access the extension-hook function before it was set', () => {
    // "Unsetting" the registry
    // @ts-ignore
    setPluginExtensionsHook(undefined);

    expect(() => {
      usePluginExtensions({ extensionPointId: 'panel-menu' });
    }).toThrow();
  });

  describe('usePluginExtensionLinks()', () => {
    test('should return only links extensions', () => {
      const usePluginExtensionsMock: UsePluginExtensions = () => ({
        extensions: [
          {
            id: '1',
            pluginId: '',
            title: '',
            description: '',
            type: PluginExtensionTypes.component,
            component: () => undefined,
          },
          {
            id: '2',
            pluginId: '',
            title: '',
            description: '',
            path: '',
            type: PluginExtensionTypes.link,
          },
          {
            id: '3',
            pluginId: '',
            title: '',
            description: '',
            path: '',
            type: PluginExtensionTypes.link,
          },
        ],
        isLoading: false,
      });

      setPluginExtensionsHook(usePluginExtensionsMock);

      const { result } = renderHook(() => usePluginLinkExtensions({ extensionPointId: 'panel-menu' }));
      const { extensions } = result.current;

      expect(extensions).toHaveLength(2);
      expect(extensions[0].type).toBe('link');
      expect(extensions[1].type).toBe('link');
      expect(extensions.find(({ id }) => id === '2')).toBeDefined();
      expect(extensions.find(({ id }) => id === '3')).toBeDefined();
    });

    test('should return the same object if the extensions do not change', () => {
      const extensionPointId = 'foo';
      const extensions: PluginExtension[] = [
        {
          id: '1',
          pluginId: '',
          title: '',
          description: '',
          path: '',
          type: PluginExtensionTypes.link,
        },
      ];

      // Mimicing that the extensions do not change between renders
      const usePluginExtensionsMock: UsePluginExtensions = () => ({
        extensions,
        isLoading: false,
      });

      setPluginExtensionsHook(usePluginExtensionsMock);

      const { result, rerender } = renderHook(() => usePluginLinkExtensions({ extensionPointId }));
      const firstExtensions = result.current.extensions;

      rerender();

      const secondExtensions = result.current.extensions;

      expect(firstExtensions === secondExtensions).toBe(true);
    });

    test('should return a different object if the extensions do change', () => {
      const extensionPointId = 'foo';

      // Mimicing that the extensions is a new array object every time
      const usePluginExtensionsMock: UsePluginExtensions = () => ({
        extensions: [
          {
            id: '1',
            pluginId: '',
            title: '',
            description: '',
            path: '',
            type: PluginExtensionTypes.link,
          },
        ],
        isLoading: false,
      });

      setPluginExtensionsHook(usePluginExtensionsMock);

      const { result, rerender } = renderHook(() => usePluginLinkExtensions({ extensionPointId }));
      const firstExtensions = result.current.extensions;

      rerender();

      const secondExtensions = result.current.extensions;

      // The results differ
      expect(firstExtensions === secondExtensions).toBe(false);
    });
  });

  describe('usePluginExtensionComponents()', () => {
    test('should return only component extensions', () => {
      const hook: UsePluginExtensions = () => ({
        extensions: [
          {
            id: '1',
            pluginId: '',
            title: '',
            description: '',
            type: PluginExtensionTypes.component,
            component: () => undefined,
          },
          {
            id: '2',
            pluginId: '',
            title: '',
            description: '',
            path: '',
            type: PluginExtensionTypes.link,
          },
          {
            id: '3',
            pluginId: '',
            title: '',
            description: '',
            path: '',
            type: PluginExtensionTypes.link,
          },
        ],
        isLoading: false,
      });

      setPluginExtensionsHook(hook);

      const hookRender = renderHook(() => usePluginComponentExtensions({ extensionPointId: 'panel-menu' }));
      const { extensions } = hookRender.result.current;

      expect(extensions).toHaveLength(1);
      expect(extensions[0].type).toBe('component');
      expect(extensions.find(({ id }) => id === '1')).toBeDefined();
    });

    test('should return the same object if the extensions do not change', () => {
      const extensionPointId = 'foo';
      const extensions: PluginExtension[] = [
        {
          id: '1',
          pluginId: '',
          title: '',
          description: '',
          type: PluginExtensionTypes.component,
          component: () => undefined,
        },
      ];

      // Mimicing that the extensions do not change between renders
      const usePluginExtensionsMock: UsePluginExtensions = () => ({
        extensions,
        isLoading: false,
      });

      setPluginExtensionsHook(usePluginExtensionsMock);

      const { result, rerender } = renderHook(() => usePluginComponentExtensions({ extensionPointId }));
      const firstExtensions = result.current.extensions;

      rerender();

      const secondExtensions = result.current.extensions;

      // The results are the same
      expect(firstExtensions === secondExtensions).toBe(true);
    });

    test('should return a different object if the extensions do change', () => {
      const extensionPointId = 'foo';

      // Mimicing that the extensions is a new array object every time
      const usePluginExtensionsMock: UsePluginExtensions = () => ({
        extensions: [
          {
            id: '1',
            pluginId: '',
            title: '',
            description: '',
            type: PluginExtensionTypes.component,
            component: () => undefined,
          },
        ],
        isLoading: false,
      });

      setPluginExtensionsHook(usePluginExtensionsMock);

      const { result, rerender } = renderHook(() => usePluginComponentExtensions({ extensionPointId }));
      const firstExtensions = result.current.extensions;

      rerender();

      const secondExtensions = result.current.extensions;

      // The results differ
      expect(firstExtensions === secondExtensions).toBe(false);
    });
  });
});
