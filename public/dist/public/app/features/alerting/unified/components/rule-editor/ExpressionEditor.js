import { __assign, __read } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { noop } from 'lodash';
import { CoreApp } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useAsync } from 'react-use';
export var ExpressionEditor = function (_a) {
    var _b, _c;
    var value = _a.value, onChange = _a.onChange, dataSourceName = _a.dataSourceName;
    var _d = useQueryMappers(dataSourceName), mapToValue = _d.mapToValue, mapToQuery = _d.mapToQuery;
    var _e = __read(useState(mapToQuery({ refId: 'A', hide: false }, value)), 2), query = _e[0], setQuery = _e[1];
    var _f = useAsync(function () {
        return getDataSourceSrv().get(dataSourceName);
    }, [dataSourceName]), error = _f.error, loading = _f.loading, dataSource = _f.value;
    var onChangeQuery = useCallback(function (query) {
        setQuery(query);
        onChange(mapToValue(query));
    }, [onChange, mapToValue]);
    if (loading || (dataSource === null || dataSource === void 0 ? void 0 : dataSource.name) !== dataSourceName) {
        return null;
    }
    if (error || !dataSource || !((_b = dataSource === null || dataSource === void 0 ? void 0 : dataSource.components) === null || _b === void 0 ? void 0 : _b.QueryEditor)) {
        var errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Data source plugin does not export any Query Editor component';
        return React.createElement("div", null,
            "Could not load query editor due to: ",
            errorMessage);
    }
    var QueryEditor = (_c = dataSource === null || dataSource === void 0 ? void 0 : dataSource.components) === null || _c === void 0 ? void 0 : _c.QueryEditor;
    return (React.createElement(QueryEditor, { query: query, queries: [query], app: CoreApp.CloudAlerting, onChange: onChangeQuery, onRunQuery: noop, datasource: dataSource }));
};
function useQueryMappers(dataSourceName) {
    return useMemo(function () {
        var settings = getDataSourceSrv().getInstanceSettings(dataSourceName);
        switch (settings === null || settings === void 0 ? void 0 : settings.type) {
            case 'loki':
            case 'prometheus':
                return {
                    mapToValue: function (query) { return query.expr; },
                    mapToQuery: function (existing, value) { return (__assign(__assign({}, existing), { expr: value })); },
                };
            default:
                throw new Error(dataSourceName + " is not supported as an expression editor");
        }
    }, [dataSourceName]);
}
//# sourceMappingURL=ExpressionEditor.js.map