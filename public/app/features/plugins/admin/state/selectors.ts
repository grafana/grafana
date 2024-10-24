import { createSelector } from '@reduxjs/toolkit';
import { debounce } from 'lodash';

import { PluginError, PluginType, unEscapeStringFromRegex } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { filterByKeyword, isPluginUpdateable } from '../helpers';
import { RequestStatus, PluginCatalogStoreState } from '../types';

import { pluginsAdapter } from './reducer';

export const selectRoot = (state: PluginCatalogStoreState) => state.plugins;

export const selectItems = createSelector(selectRoot, ({ items }) => items);

export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectItems);

const debouncedTrackSearch = debounce((count) => {
  reportInteraction('plugins_search', {
    resultsCount: count,
    creator_team: 'grafana_plugins_catalog',
    schema_version: '1.0.0',
  });
}, 300);

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

  // (Optional, only applied if set)
  hasUpdate?: boolean;
};

export const selectPlugins = (filters: PluginFilters) =>
  createSelector(selectAll, (plugins) => {
    const keyword = filters.keyword ? unEscapeStringFromRegex(filters.keyword.toLowerCase()) : '';
    // Fuzzy search does not consider plugin type filter
    const filteredPluginIds = keyword !== '' ? filterByKeyword(plugins, keyword) : null;

    // Filters are applied here
    const filteredPlugins = plugins.filter((plugin) => {
      if (keyword && filteredPluginIds == null) {
        return false;
      }

      if (keyword && !filteredPluginIds?.includes(plugin.id)) {
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

      if (filters.hasUpdate !== undefined && (plugin.hasUpdate !== filters.hasUpdate || !isPluginUpdateable(plugin))) {
        return false;
      }

      return true;
    });

    if (keyword) {
      debouncedTrackSearch(filteredPlugins.length);
    }

    return filteredPlugins;
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
