import uFuzzy from '@leeoniya/ufuzzy';
import { createSelector } from '@reduxjs/toolkit';

import { PluginError, PluginType, unEscapeStringFromRegex } from '@grafana/data';

import { RequestStatus, PluginCatalogStoreState, CatalogPlugin } from '../types';

import { pluginsAdapter } from './reducer';

export const selectRoot = (state: PluginCatalogStoreState) => state.plugins;

export const selectItems = createSelector(selectRoot, ({ items }) => items);

export const selectDisplayMode = createSelector(selectRoot, ({ settings }) => settings.displayMode);

export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectItems);

export type PluginFilters = {
  // Searches for a string in certain fields (e.g. "name" or "orgName")
  // (Note: this will be an escaped regex string as it comes from `FilterInput`)
  keyword?: string;

  // (Optional, only applied if set)
  type?: PluginType;

  // (Optional, only applied if set)
  isInstalled?: boolean;

  // (Optional, only applied if set)
  isEnterprise?: boolean;
};

export const selectPlugins = (filters: PluginFilters) =>
  createSelector(selectAll, (plugins) => {
    console.log('filters', filters);
    const keyword = filters.keyword ? unEscapeStringFromRegex(filters.keyword.toLowerCase()) : '';

    function filterObjects(plugins: CatalogPlugin[]): { [key: string]: string } {
      return plugins.reduce(
        (result, { id, name, type }: CatalogPlugin) => {
          result[id] = `${id} - ${name} - ${type}`;
          return result;
        },
        {} as { [key: string]: string }
      );
    }
    function fuzzySearch(query: string, dataArray: string[]) {
      let opts = {};
      let uf = new uFuzzy(opts);
      let idxs = uf.filter(dataArray, query);

      if (idxs != null && idxs.length > 0) {
        const resultObject: { [key: string]: string } = {};
        for (let i = 0; i < idxs.length; i++) {
          resultObject[idxs[i]] = dataArray[idxs[i]];
        }
        return resultObject;
      } else {
        return null;
      }
    }
    const pluginsForSearch: { [key: string]: string } = filterObjects(plugins);

    const pluginsAfterFuzzySearch = fuzzySearch(keyword, Object.values(pluginsForSearch));
    console.log('pluginsAfterFuzzySearch', pluginsAfterFuzzySearch);

    return plugins.filter((plugin) => {
      // const fieldsToSearchIn = [plugin.name, plugin.orgName].filter(Boolean).map((f) => f.toLowerCase());

      // if (keyword && !fieldsToSearchIn.some((f) => f.includes(keyword))) {
      //   return false;
      // }
      // if(pluginsAfterFuzzySearch != null) {
      //   const filteredIds = Object.keys(pluginsAfterFuzzySearch).map(String);
      //   const filteredPlugins = plugins.filter((plugin) => filteredIds.includes(plugin.id));
      // }
      if (keyword && pluginsAfterFuzzySearch === null) {
        console.log('test1');
        return false;
      }

      if (keyword && pluginsAfterFuzzySearch != null && !Object.keys(pluginsAfterFuzzySearch).includes(plugin.id)) {
        console.log('test2');
        return false;
      }

      if (filters.type && plugin.type !== filters.type) {
        return false;
      }

      if (filters.isInstalled !== undefined && plugin.isInstalled !== filters.isInstalled) {
        return false;
      }

      if (filters.isEnterprise !== undefined && plugin.isEnterprise !== filters.isEnterprise) {
        return false;
      }

      console.log('test0');
      return true;
    });
  });

export const selectPluginErrors = (filterByPluginType?: PluginType) =>
  createSelector(selectAll, (plugins) => {
    const pluginErrors: PluginError[] = [];
    for (const plugin of plugins) {
      if (plugin.error && (!filterByPluginType || plugin.type === filterByPluginType)) {
        pluginErrors.push({
          pluginId: plugin.id,
          errorCode: plugin.error,
          pluginType: plugin.type,
        });
      }
    }
    return pluginErrors;
  });

// The following selectors are used to get information about the outstanding or completed plugins-related network requests.
export const selectRequest = (actionType: string) =>
  createSelector(selectRoot, ({ requests = {} }) => requests[actionType]);

export const selectIsRequestPending = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) => request?.status === RequestStatus.Pending);

export const selectRequestError = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) =>
    request?.status === RequestStatus.Rejected ? request?.error : null
  );

export const selectIsRequestNotFetched = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) => request === undefined);
