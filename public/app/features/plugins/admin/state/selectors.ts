import { createSelector } from '@reduxjs/toolkit';

import { PluginError, PluginErrorCode, unEscapeStringFromRegex } from '@grafana/data';

import { RequestStatus, PluginCatalogStoreState, CatalogPlugin } from '../types';

import { pluginsAdapter } from './reducer';

export const selectRoot = (state: PluginCatalogStoreState) => state.plugins;

export const selectItems = createSelector(selectRoot, ({ items }) => items);

export const selectDisplayMode = createSelector(selectRoot, ({ settings }) => settings.displayMode);

export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectItems);

const findByState = (state: string) =>
  createSelector(selectAll, (plugins) =>
    plugins.filter((plugin) => (state === 'installed' ? plugin.isInstalled : !plugin.isCore))
  );

type PluginFilters = {
  state: string;
  type: string;
};

const findPluginsByFilters = (filters: PluginFilters) =>
  createSelector(findByState(filters.state), (plugins) =>
    plugins.filter((plugin) => filters.type === 'all' || plugin.type === filters.type)
  );

const findByKeyword = (plugins: CatalogPlugin[], query: string) => {
  if (query === '') {
    return plugins;
  }

  return plugins.filter((plugin) => {
    const fields: String[] = [];
    if (plugin.name) {
      fields.push(plugin.name.toLowerCase());
    }

    if (plugin.orgName) {
      fields.push(plugin.orgName.toLowerCase());
    }

    return fields.some((f) => f.includes(unEscapeStringFromRegex(query).toLowerCase()));
  });
};

export const find = (searchBy: string, filterBy: string, filterByType: string) =>
  createSelector(findPluginsByFilters({ state: filterBy, type: filterByType }), (filteredPlugins) =>
    findByKeyword(filteredPlugins, searchBy)
  );

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
