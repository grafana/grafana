import { PluginType } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock, getPluginsStateMock } from '../__mocks__';

import { find } from './selectors';

describe('Plugins Selectors', () => {
  describe('find()', () => {
    const store = configureStore({
      plugins: getPluginsStateMock([
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true, type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true, type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true, type: PluginType.panel }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: false, type: PluginType.panel }),
        getCatalogPluginMock({ id: 'plugin-5', name: 'Plugin 5', isInstalled: true, type: PluginType.app }),
      ]),
    });

    it('should return all plugins if there are no filters', () => {
      const query = '';
      const filterBy = 'all';
      const filterByType = 'all';
      const results = find(query, filterBy, filterByType)(store.getState());

      expect(results).toHaveLength(5);
    });

    it('should be possible to search only by the "query"', () => {
      const query = 'Plugin 3';
      const filterBy = 'all';
      const filterByType = 'all';
      const results = find(query, filterBy, filterByType)(store.getState());

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plugin 3');
    });

    it('should be possible to search by plugin type', () => {
      const query = '';
      const filterBy = 'all';
      const filterByType = PluginType.panel;
      const results = find(query, filterBy, filterByType)(store.getState());

      expect(results).toHaveLength(2);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 3', 'Plugin 4']);
    });

    it('should be possible to search by plugin state (installed / all)', () => {
      const query = '';
      const filterBy = 'installed';
      const filterByType = 'all';
      const results = find(query, filterBy, filterByType)(store.getState());

      expect(results).toHaveLength(4);
      expect(results.map(({ name }) => name)).toEqual(['Plugin 1', 'Plugin 2', 'Plugin 3', 'Plugin 5']);
    });

    it('should be possible to search by multiple filters', () => {
      const query = '2';
      const filterBy = 'all';
      const filterByType = PluginType.datasource;
      const results = find(query, filterBy, filterByType)(store.getState());

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plugin 2');
    });
  });
});
