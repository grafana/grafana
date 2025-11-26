import { firstValueFrom } from 'rxjs';

import { PluginExtensionCommandPaletteContext } from '@grafana/data';

import { CommandPaletteDynamicRegistry } from './CommandPaletteDynamicRegistry';

describe('CommandPaletteDynamicRegistry', () => {
  const pluginId = 'test-plugin';

  describe('Registry Management', () => {
    it('should return empty registry when no extensions registered', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const observable = registry.asObservable();
      const state = await firstValueFrom(observable);
      expect(state).toEqual({});
    });

    it('should be possible to register command palette dynamic providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const state = await registry.getState();
      expect(state).toEqual({
        [`${pluginId}/0`]: [
          {
            pluginId,
            config: {
              searchProvider: mockSearchProvider,
              category: undefined,
              minQueryLength: 2,
            },
          },
        ],
      });
    });

    it('should apply default values for optional config properties', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const state = await registry.getState();
      const item = state[`${pluginId}/0`][0];

      expect(item.config.category).toBeUndefined();
      expect(item.config.minQueryLength).toBe(2);
    });

    it('should preserve custom config values when provided', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            category: 'Custom Category',
            minQueryLength: 5,
          },
        ],
      });

      const state = await registry.getState();
      const item = state[`${pluginId}/0`][0];

      expect(item.config.category).toBe('Custom Category');
      expect(item.config.minQueryLength).toBe(5);
    });

    it('should register multiple providers from the same plugin', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider1 = jest.fn().mockResolvedValue([]);
      const mockSearchProvider2 = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider1,
          },
          {
            searchProvider: mockSearchProvider2,
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(2);
      expect(state[`${pluginId}/0`]).toBeDefined();
      expect(state[`${pluginId}/1`]).toBeDefined();
    });

    it('should notify subscribers when the registry changes', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const observable = registry.asObservable();
      const subscribeCallback = jest.fn();

      observable.subscribe(subscribeCallback);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: jest.fn().mockResolvedValue([]),
          },
        ],
      });

      expect(subscribeCallback).toHaveBeenCalledTimes(2); // initial empty state + registration
    });

    it('should not be possible to register on a read-only registry', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const readOnlyRegistry = new CommandPaletteDynamicRegistry({
        registrySubject: registry['registrySubject'],
      });

      expect(() => {
        readOnlyRegistry.register({
          pluginId,
          configs: [
            {
              searchProvider: jest.fn(),
            },
          ],
        });
      }).toThrow('Cannot register to a read-only registry');
    });

    it('should create a read-only version of the registry', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const readOnlyRegistry = registry.readOnly();

      expect(() => {
        readOnlyRegistry.register({
          pluginId,
          configs: [
            {
              searchProvider: jest.fn(),
            },
          ],
        });
      }).toThrow('Cannot register to a read-only registry');

      const currentState = await readOnlyRegistry.getState();
      expect(Object.keys(currentState)).toHaveLength(0);
    });

    it('should pass down fresh registrations to the read-only version of the registry', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const readOnlyRegistry = registry.readOnly();
      const subscribeCallback = jest.fn();
      let readOnlyState;

      // Should have no providers registered in the beginning
      readOnlyState = await readOnlyRegistry.getState();
      expect(Object.keys(readOnlyState)).toHaveLength(0);

      readOnlyRegistry.asObservable().subscribe(subscribeCallback);

      // Register a provider to the original (writable) registry
      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: jest.fn().mockResolvedValue([]),
          },
        ],
      });

      // The read-only registry should have received the new provider
      readOnlyState = await readOnlyRegistry.getState();
      expect(Object.keys(readOnlyState)).toHaveLength(1);

      expect(subscribeCallback).toHaveBeenCalledTimes(2); // initial empty + registration
      expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual([`${pluginId}/0`]);
    });
  });

  describe('Config Validation', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should not register provider without searchProvider', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            // @ts-ignore - testing invalid config
            searchProvider: undefined,
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not register provider with non-function searchProvider', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            // @ts-ignore - testing invalid config
            searchProvider: 'not-a-function',
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log provider registration in dev mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: jest.fn().mockResolvedValue([]),
          },
        ],
      });

      await registry.getState();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Registered provider: test-plugin/0'));

      consoleLogSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Search Functionality', () => {
    it('should execute search across all registered providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider1 = jest.fn().mockResolvedValue([{ id: 'result1', title: 'Result 1' }]);
      const mockSearchProvider2 = jest.fn().mockResolvedValue([{ id: 'result2', title: 'Result 2' }]);

      registry.register({
        pluginId: 'plugin1',
        configs: [
          {
            searchProvider: mockSearchProvider1,
          },
        ],
      });

      registry.register({
        pluginId: 'plugin2',
        configs: [
          {
            searchProvider: mockSearchProvider2,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test query',
      };

      const results = await registry.search(context);

      // Search providers receive DynamicPluginExtensionCommandPaletteContext with required fields
      expect(mockSearchProvider1).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'test query',
          signal: expect.any(Object),
        })
      );
      expect(mockSearchProvider2).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'test query',
          signal: expect.any(Object),
        })
      );
      expect(results.size).toBe(2);
    });

    it('should pass context with AbortSignal to search providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const abortController = new AbortController();
      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
        signal: abortController.signal,
      };

      await registry.search(context);

      expect(mockSearchProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'test',
          signal: expect.any(Object),
        })
      );
    });

    it('should not search when query is below minimum length', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            minQueryLength: 3,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'ab', // Only 2 characters
      };

      await registry.search(context);

      expect(mockSearchProvider).not.toHaveBeenCalled();
    });

    it('should search when query meets minimum length', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            minQueryLength: 2,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'ab', // Exactly 2 characters
      };

      await registry.search(context);

      expect(mockSearchProvider).toHaveBeenCalled();
    });

    it('should limit results to 5 items per provider', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        { id: '1', title: 'Result 1' },
        { id: '2', title: 'Result 2' },
        { id: '3', title: 'Result 3' },
        { id: '4', title: 'Result 4' },
        { id: '5', title: 'Result 5' },
        { id: '6', title: 'Result 6' },
        { id: '7', title: 'Result 7' },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items).toHaveLength(5);
      expect(searchResult?.items[4].id).toBe('5');
    });
  });

  describe('Result Validation', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should filter out results without id', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        { id: 'valid', title: 'Valid Result' },
        // @ts-ignore - testing invalid result
        { title: 'Invalid Result' },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should filter out results with non-string id', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        { id: 'valid', title: 'Valid Result' },
        // @ts-ignore - testing invalid result
        { id: 123, title: 'Invalid Result' },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should filter out results without title', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        { id: 'valid', title: 'Valid Result' },
        // @ts-ignore - testing invalid result
        { id: 'invalid' },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should filter out results with non-string title', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        { id: 'valid', title: 'Valid Result' },
        // @ts-ignore - testing invalid result
        { id: 'invalid', title: 123 },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should not include provider in results if no valid items', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        // @ts-ignore - testing invalid results
        { id: 'invalid' }, // missing title
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(0);
    });

    it('should warn if provider returns non-array', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      // @ts-ignore - testing invalid return value
      const mockSearchProvider = jest.fn().mockResolvedValue('not-an-array');

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle search provider errors gracefully', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockRejectedValue(new Error('Search failed'));

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Search failed'),
        expect.objectContaining({
          error: 'Error: Search failed',
        })
      );
    });

    it('should not log AbortErrors', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockSearchProvider = jest.fn().mockRejectedValue(abortError);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      await registry.search(context);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should continue searching other providers if one fails', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const failingProvider = jest.fn().mockRejectedValue(new Error('Failed'));
      const successProvider = jest.fn().mockResolvedValue([{ id: 'success', title: 'Success Result' }]);

      registry.register({
        pluginId: 'failing-plugin',
        configs: [
          {
            searchProvider: failingProvider,
          },
        ],
      });

      registry.register({
        pluginId: 'success-plugin',
        configs: [
          {
            searchProvider: successProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(1);
      expect(results.get('success-plugin/0')).toBeDefined();
    });
  });

  describe('Search Context', () => {
    it('should handle empty search query', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            minQueryLength: 0,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: '',
      };

      await registry.search(context);

      expect(mockSearchProvider).toHaveBeenCalled();
    });

    it('should handle undefined search query', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            minQueryLength: 0,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {};

      await registry.search(context);

      expect(mockSearchProvider).toHaveBeenCalled();
    });
  });

  describe('Result Structure', () => {
    it('should return results with correct structure', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([
        {
          id: 'test-id',
          title: 'Test Title',
          description: 'Test Description',
          path: '/test/path',
          keywords: ['test', 'keyword'],
          section: 'Test Section',
          data: { custom: 'data' },
        },
      ]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.items[0]).toEqual({
        id: 'test-id',
        title: 'Test Title',
        description: 'Test Description',
        path: '/test/path',
        keywords: ['test', 'keyword'],
        section: 'Test Section',
        data: { custom: 'data' },
      });
    });

    it('should include config information in search result', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([{ id: 'test', title: 'Test' }]);

      registry.register({
        pluginId,
        configs: [
          {
            searchProvider: mockSearchProvider,
            category: 'Test Category',
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/0`);

      expect(searchResult?.config.pluginId).toBe(pluginId);
      expect(searchResult?.config.config.category).toBe('Test Category');
    });
  });
});
