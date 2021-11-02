import { __read, __spreadArray } from "tslib";
import { getDataSourceRef } from '@grafana/data';
export var getNextRefIdChar = function (queries) {
    var _loop_1 = function (num) {
        var refId = getRefId(num);
        if (!queries.some(function (query) { return query.refId === refId; })) {
            return { value: refId };
        }
    };
    for (var num = 0;; num++) {
        var state_1 = _loop_1(num);
        if (typeof state_1 === "object")
            return state_1.value;
    }
};
export function addQuery(queries, query, datasource) {
    var q = query || {};
    q.refId = getNextRefIdChar(queries);
    q.hide = false;
    if (!q.datasource && datasource) {
        q.datasource = datasource;
    }
    return __spreadArray(__spreadArray([], __read(queries), false), [q], false);
}
export function updateQueries(newSettings, queries, extensionID, // pass this in because importing it creates a circular dependency
dsSettings) {
    var datasource = getDataSourceRef(newSettings);
    if (!newSettings.meta.mixed && (dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.meta.mixed)) {
        return queries.map(function (q) {
            if (q.datasource !== extensionID) {
                q.datasource = datasource;
            }
            return q;
        });
    }
    else if (!newSettings.meta.mixed && (dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.meta.id) !== newSettings.meta.id) {
        // we are changing data source type, clear queries
        return [{ refId: 'A', datasource: datasource }];
    }
    return queries;
}
export function isDataQuery(url) {
    if (url.indexOf('api/datasources/proxy') !== -1 ||
        url.indexOf('api/tsdb/query') !== -1 ||
        url.indexOf('api/ds/query') !== -1) {
        return true;
    }
    return false;
}
export function isLocalUrl(url) {
    return !url.match(/^http/);
}
function getRefId(num) {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num < letters.length) {
        return letters[num];
    }
    else {
        return getRefId(Math.floor(num / letters.length) - 1) + letters[num % letters.length];
    }
}
//# sourceMappingURL=query.js.map