import { createSelector } from 'reselect';
import { pluginsAdapter } from './reducer';

// TODO<use the proper store state here>
export const selectRoot = (state: any) => state.plugins;

export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectRoot);

const isInstalled = (filterBy: string) =>
  createSelector(selectAll, (plugins) =>
    plugins.filter((plugin) => (filterBy === 'installed' ? plugin.isInstalled : !plugin.isCore))
  );

const findByInstallAndType = (filterBy: string, filterByType: string) =>
  createSelector(isInstalled(filterBy), (plugins) =>
    plugins.filter((plugin) => filterByType === 'all' || plugin.type === filterByType)
  );

const findByKeyword = (searchBy: string) =>
  createSelector(selectAll, (plugins) => {
    if (searchBy === '') {
      return [];
    }

    return plugins.filter((plugin) => {
      const fields: String[] = [];
      if (plugin.name) {
        fields.push(plugin.name.toLowerCase());
      }

      if (plugin.orgName) {
        fields.push(plugin.orgName.toLowerCase());
      }

      return fields.some((f) => f.includes(searchBy.toLowerCase()));
    });
  });

export const find = (searchBy: string, filterBy: string, filterByType: string) =>
  createSelector(
    findByInstallAndType(filterBy, filterByType),
    findByKeyword(searchBy),
    (filteredPlugins, searchedPlugins) => {
      return searchBy === '' ? filteredPlugins : searchedPlugins;
    }
  );
