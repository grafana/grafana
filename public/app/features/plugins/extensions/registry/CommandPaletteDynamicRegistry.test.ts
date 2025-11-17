import { firstValueFrom } from 'rxjs';

import { PluginExtensionCommandPaletteContext } from '@grafana/data';

import { log } from '../logs/log';
import { resetLogMock } from '../logs/testUtils';
import { isGrafanaDevMode } from '../utils';

import { CommandPaletteDynamicRegistry } from './CommandPaletteDynamicRegistry';
import { MSG_CANNOT_REGISTER_READ_ONLY } from './Registry';

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
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

describe('CommandPaletteDynamicRegistry', () => {
  const pluginId = 'test-plugin';

  beforeEach(() => {
    resetLogMock(log);
    jest.mocked(isGrafanaDevMode).mockReturnValue(false);
  });

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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const state = await registry.getState();
      expect(state).toEqual({
        [`${pluginId}/Test Provider`]: [
          {
            pluginId,
            config: {
              title: 'Test Provider',
              searchProvider: mockSearchProvider,
              category: pluginId,
              minQueryLength: 2,
              debounceMs: 300,
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const state = await registry.getState();
      const item = state[`${pluginId}/Test Provider`][0];

      expect(item.config.category).toBe(pluginId);
      expect(item.config.minQueryLength).toBe(2);
      expect(item.config.debounceMs).toBe(300);
    });

    it('should preserve custom config values when provided', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Custom Provider',
            searchProvider: mockSearchProvider,
            category: 'Custom Category',
            minQueryLength: 5,
            debounceMs: 500,
          },
        ],
      });

      const state = await registry.getState();
      const item = state[`${pluginId}/Custom Provider`][0];

      expect(item.config.category).toBe('Custom Category');
      expect(item.config.minQueryLength).toBe(5);
      expect(item.config.debounceMs).toBe(500);
    });

    it('should register multiple providers from the same plugin', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider1 = jest.fn().mockResolvedValue([]);
      const mockSearchProvider2 = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Provider 1',
            searchProvider: mockSearchProvider1,
          },
          {
            title: 'Provider 2',
            searchProvider: mockSearchProvider2,
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(2);
      expect(state[`${pluginId}/Provider 1`]).toBeDefined();
      expect(state[`${pluginId}/Provider 2`]).toBeDefined();
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
            title: 'Test Provider',
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
              title: 'Test',
              searchProvider: jest.fn(),
            },
          ],
        });
      }).toThrow(MSG_CANNOT_REGISTER_READ_ONLY);
    });

    it('should create a read-only version of the registry', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const readOnlyRegistry = registry.readOnly();

      expect(() => {
        readOnlyRegistry.register({
          pluginId,
          configs: [
            {
              title: 'Test',
              searchProvider: jest.fn(),
            },
          ],
        });
      }).toThrow(MSG_CANNOT_REGISTER_READ_ONLY);

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
            title: 'Test Provider',
            searchProvider: jest.fn().mockResolvedValue([]),
          },
        ],
      });

      // The read-only registry should have received the new provider
      readOnlyState = await readOnlyRegistry.getState();
      expect(Object.keys(readOnlyState)).toHaveLength(1);

      expect(subscribeCallback).toHaveBeenCalledTimes(2); // initial empty + registration
      expect(Object.keys(subscribeCallback.mock.calls[1][0])).toEqual([`${pluginId}/Test Provider`]);
    });
  });

  describe('Config Validation', () => {
    it('should not register provider without title', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            // @ts-ignore - testing invalid config
            title: '',
            searchProvider: jest.fn(),
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should not register provider with non-string title', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            // @ts-ignore - testing invalid config
            title: 123,
            searchProvider: jest.fn(),
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should not register provider without searchProvider', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Test',
            // @ts-ignore - testing invalid config
            searchProvider: undefined,
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should not register provider with non-function searchProvider', async () => {
      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Test',
            // @ts-ignore - testing invalid config
            searchProvider: 'not-a-function',
          },
        ],
      });

      const state = await registry.getState();
      expect(Object.keys(state)).toHaveLength(0);
      expect(log.error).toHaveBeenCalled();
    });

    it('should log provider registration in dev mode', async () => {
      jest.mocked(isGrafanaDevMode).mockReturnValue(true);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const registry = new CommandPaletteDynamicRegistry();

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Test Provider',
            searchProvider: jest.fn().mockResolvedValue([]),
          },
        ],
      });

      await registry.getState();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered provider: test-plugin/Test Provider')
      );

      consoleLogSpy.mockRestore();
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
            title: 'Provider 1',
            searchProvider: mockSearchProvider1,
          },
        ],
      });

      registry.register({
        pluginId: 'plugin2',
        configs: [
          {
            title: 'Provider 2',
            searchProvider: mockSearchProvider2,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test query',
      };

      const results = await registry.search(context);

      expect(mockSearchProvider1).toHaveBeenCalledWith(context);
      expect(mockSearchProvider2).toHaveBeenCalledWith(context);
      expect(results.size).toBe(2);
    });

    it('should pass context with AbortSignal to search providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Test Provider',
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
            title: 'Test Provider',
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
            title: 'Test Provider',
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

    it('should skip inactive providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);
      const isActiveFn = jest.fn().mockReturnValue(false);

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Inactive Provider',
            searchProvider: mockSearchProvider,
            isActive: isActiveFn,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      await registry.search(context);

      expect(isActiveFn).toHaveBeenCalledWith(context);
      expect(mockSearchProvider).not.toHaveBeenCalled();
    });

    it('should execute search for active providers', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockResolvedValue([]);
      const isActiveFn = jest.fn().mockReturnValue(true);

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Active Provider',
            searchProvider: mockSearchProvider,
            isActive: isActiveFn,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      await registry.search(context);

      expect(isActiveFn).toHaveBeenCalledWith(context);
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.items).toHaveLength(5);
      expect(searchResult?.items[4].id).toBe('5');
    });
  });

  describe('Result Validation', () => {
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(log.warning).toHaveBeenCalled();
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(log.warning).toHaveBeenCalled();
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(log.warning).toHaveBeenCalled();
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.items).toHaveLength(1);
      expect(searchResult?.items[0].id).toBe('valid');
      expect(log.warning).toHaveBeenCalled();
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
            title: 'Test Provider',
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(0);
      expect(log.warning).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle search provider errors gracefully', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const mockSearchProvider = jest.fn().mockRejectedValue(new Error('Search failed'));

      registry.register({
        pluginId,
        configs: [
          {
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(0);
      expect(log.error).toHaveBeenCalledWith(
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      await registry.search(context);

      expect(log.error).not.toHaveBeenCalled();
    });

    it('should continue searching other providers if one fails', async () => {
      const registry = new CommandPaletteDynamicRegistry();
      const failingProvider = jest.fn().mockRejectedValue(new Error('Failed'));
      const successProvider = jest.fn().mockResolvedValue([{ id: 'success', title: 'Success Result' }]);

      registry.register({
        pluginId: 'failing-plugin',
        configs: [
          {
            title: 'Failing Provider',
            searchProvider: failingProvider,
          },
        ],
      });

      registry.register({
        pluginId: 'success-plugin',
        configs: [
          {
            title: 'Success Provider',
            searchProvider: successProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);

      expect(results.size).toBe(1);
      expect(results.get('success-plugin/Success Provider')).toBeDefined();
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
            title: 'Test Provider',
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
            title: 'Test Provider',
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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

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
            title: 'Test Provider',
            searchProvider: mockSearchProvider,
            category: 'Test Category',
          },
        ],
      });

      const context: PluginExtensionCommandPaletteContext = {
        searchQuery: 'test',
      };

      const results = await registry.search(context);
      const searchResult = results.get(`${pluginId}/Test Provider`);

      expect(searchResult?.config.pluginId).toBe(pluginId);
      expect(searchResult?.config.config.title).toBe('Test Provider');
      expect(searchResult?.config.config.category).toBe('Test Category');
    });
  });
});
