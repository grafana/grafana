var _a;
import { createSelector } from 'reselect';
import { RequestStatus } from '../types';
import { pluginsAdapter } from './reducer';
export var selectRoot = function (state) { return state.plugins; };
export var selectItems = createSelector(selectRoot, function (_a) {
    var items = _a.items;
    return items;
});
export var selectDisplayMode = createSelector(selectRoot, function (_a) {
    var settings = _a.settings;
    return settings.displayMode;
});
export var selectAll = (_a = pluginsAdapter.getSelectors(selectItems), _a.selectAll), selectById = _a.selectById;
var selectInstalled = function (filterBy) {
    return createSelector(selectAll, function (plugins) {
        return plugins.filter(function (plugin) { return (filterBy === 'installed' ? plugin.isInstalled : !plugin.isCore); });
    });
};
var findByInstallAndType = function (filterBy, filterByType) {
    return createSelector(selectInstalled(filterBy), function (plugins) {
        return plugins.filter(function (plugin) { return filterByType === 'all' || plugin.type === filterByType; });
    });
};
var findByKeyword = function (searchBy) {
    return createSelector(selectAll, function (plugins) {
        if (searchBy === '') {
            return [];
        }
        return plugins.filter(function (plugin) {
            var fields = [];
            if (plugin.name) {
                fields.push(plugin.name.toLowerCase());
            }
            if (plugin.orgName) {
                fields.push(plugin.orgName.toLowerCase());
            }
            return fields.some(function (f) { return f.includes(searchBy.toLowerCase()); });
        });
    });
};
export var find = function (searchBy, filterBy, filterByType) {
    return createSelector(findByInstallAndType(filterBy, filterByType), findByKeyword(searchBy), function (filteredPlugins, searchedPlugins) {
        return searchBy === '' ? filteredPlugins : searchedPlugins;
    });
};
export var selectRequest = function (actionType) {
    return createSelector(selectRoot, function (_a) {
        var _b = _a.requests, requests = _b === void 0 ? {} : _b;
        return requests[actionType];
    });
};
export var selectIsRequestPending = function (actionType) {
    return createSelector(selectRequest(actionType), function (request) { return (request === null || request === void 0 ? void 0 : request.status) === RequestStatus.Pending; });
};
export var selectRequestError = function (actionType) {
    return createSelector(selectRequest(actionType), function (request) {
        return (request === null || request === void 0 ? void 0 : request.status) === RequestStatus.Rejected ? request === null || request === void 0 ? void 0 : request.error : null;
    });
};
export var selectIsRequestNotFetched = function (actionType) {
    return createSelector(selectRequest(actionType), function (request) { return request === undefined; });
};
//# sourceMappingURL=selectors.js.map