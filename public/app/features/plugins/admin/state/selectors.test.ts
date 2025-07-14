import { PluginType } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock, getPluginsStateMock } from '../mocks/mockHelpers';

import { selectPlugins } from './selectors';

describe('Plugins Selectors', () => {
  describe('selectPlugins()', () => {
    const store = configureStore({
      plugins: getPluginsStateMock([
        getCatalogPluginMock({
          id: 'plugin-1',
          name: 'Plugin 1',
          isInstalled: true,
          type: PluginType.datasource,
          isCore: true,
        }),
        getCatalogPluginMock({
          id: 'plugin-2',
          name: 'Plugin 2',
          isInstalled: true,
          type: PluginType.datasource,
          isCore: true,
        }),
        getCatalogPluginMock({
          id: 'plugin-3',
          name: 'Plugin 3',
          isInstalled: true,
          type: PluginType.panel,
          isCore: false,
        }),
        getCatalogPluginMock({
          id: 'plugin-4',
          name: 'Plugin 4',
          isInstalled: false,
          type: PluginType.panel,
          isCore: false,
        }),
        getCatalogPluginMock({
          id: 'plugin-5',
          name: 'Plugin 5',
          isInstalled: true,
          type: PluginType.app,
          isCore: false,
          hasUpdate: true,
        }),
      ]),
    });

    it('should return all plugins if there are no filters', () => {
      const results = selectPlugins({})(store.getState());

      expect(results).toHaveLength(5);
    });

    it('should be possible to search only by the "keyword"', () => {
      const results = selectPlugins({ keyword: 'Plugin 3' })(store.getState());

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plugin 3');
    });

    it('should be possible to search by plugin type', () => {
      const results = selectPlugins({ type: PluginType.panel })(store.getState());

      expect(results).toHaveLength(2);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 3', 'Plugin 4']);
    });

    it('should be possible to only search for installed plugins', () => {
      const results = selectPlugins({ isInstalled: true })(store.getState());

      expect(results).toHaveLength(4);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 1', 'Plugin 2', 'Plugin 3', 'Plugin 5']);
    });

    it('should be possible to only search for not yet installed plugins', () => {
      const results = selectPlugins({ isInstalled: false })(store.getState());

      expect(results).toHaveLength(1);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 4']);
    });

    it('should be possible to only search for with update', () => {
      const results = selectPlugins({ hasUpdate: true })(store.getState());

      expect(results).toHaveLength(1);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 5']);
    });

    it('should be possible to search by multiple filters', () => {
      const results = selectPlugins({ keyword: '2', type: PluginType.datasource })(store.getState());

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plugin 2');
    });
  });
});
