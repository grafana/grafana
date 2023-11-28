import { createSelector } from '@reduxjs/toolkit';
import { unEscapeStringFromRegex } from '@grafana/data';
import { RequestStatus } from '../types';
import { pluginsAdapter } from './reducer';
export const selectRoot = (state) => state.plugins;
export const selectItems = createSelector(selectRoot, ({ items }) => items);
export const selectDisplayMode = createSelector(selectRoot, ({ settings }) => settings.displayMode);
export const { selectAll, selectById } = pluginsAdapter.getSelectors(selectItems);
export const selectPlugins = (filters) => createSelector(selectAll, (plugins) => {
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
export const selectPluginErrors = (filterByPluginType) => createSelector(selectAll, (plugins) => {
    const pluginErrors = [];
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
export const selectRequest = (actionType) => createSelector(selectRoot, ({ requests = {} }) => requests[actionType]);
export const selectIsRequestPending = (actionType) => createSelector(selectRequest(actionType), (request) => (request === null || request === void 0 ? void 0 : request.status) === RequestStatus.Pending);
export const selectRequestError = (actionType) => createSelector(selectRequest(actionType), (request) => (request === null || request === void 0 ? void 0 : request.status) === RequestStatus.Rejected ? request === null || request === void 0 ? void 0 : request.error : null);
export const selectIsRequestNotFetched = (actionType) => createSelector(selectRequest(actionType), (request) => request === undefined);
//# sourceMappingURL=selectors.js.map