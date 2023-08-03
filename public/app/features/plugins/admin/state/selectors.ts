import { createSelector } from '@reduxjs/toolkit';

import { PluginError, PluginErrorCode, PluginType, unEscapeStringFromRegex } from '@grafana/data';

import { RequestStatus, PluginCatalogStoreState } from '../types';

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
  isCore?: boolean;

  // (Optional, only applied if set)
  isInstalled?: boolean;

  // (Optional, only applied if set)
  isEnterprise?: boolean;
};

export const selectPlugins = (filters: PluginFilters) =>
  createSelector(selectAll, (plugins) => {
    const keyword = filters.keyword ? unEscapeStringFromRegex(filters.keyword.toLowerCase()) : '';

    return plugins.filter((plugin) => {
      const fieldsToSearchIn = [plugin.name, plugin.orgName].filter(Boolean).map((f) => f.toLowerCase());

      if (keyword && !fieldsToSearchIn.some((f) => f.includes(keyword))) {
        return false;
      }

      if (filters.type && plugin.type !== filters.type) {
        return false;
      }

      if (filters.isInstalled !== undefined && plugin.isInstalled !== filters.isInstalled) {
        return false;
      }

      if (filters.isCore !== undefined && plugin.isCore !== filters.isCore) {
        return false;
      }

      if (filters.isEnterprise !== undefined && plugin.isEnterprise !== filters.isEnterprise) {
        return false;
      }

      return true;
    });
  });

export const selectPluginErrors = createSelector(selectAll, (plugins) =>
  plugins
    ? plugins
        .filter((p) => Boolean(p.error))
        .map(
          (p): PluginError => ({
            pluginId: p.id,
            errorCode: p!.error as PluginErrorCode,
          })
        )
    : []
);

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
