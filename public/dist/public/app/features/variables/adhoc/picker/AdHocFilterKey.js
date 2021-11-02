import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import React from 'react';
import { Icon, SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
var MIN_WIDTH = 90;
export var AdHocFilterKey = function (_a) {
    var datasource = _a.datasource, onChange = _a.onChange, filterKey = _a.filterKey;
    var loadKeys = function () { return fetchFilterKeys(datasource); };
    var loadKeysWithRemove = function () { return fetchFilterKeysWithRemove(datasource); };
    if (filterKey === null) {
        return (React.createElement("div", { className: "gf-form" },
            React.createElement(SegmentAsync, { className: "query-segment-key", Component: plusSegment, value: filterKey, onChange: onChange, loadOptions: loadKeys, inputMinWidth: MIN_WIDTH })));
    }
    return (React.createElement("div", { className: "gf-form" },
        React.createElement(SegmentAsync, { className: "query-segment-key", value: filterKey, onChange: onChange, loadOptions: loadKeysWithRemove, inputMinWidth: MIN_WIDTH })));
};
export var REMOVE_FILTER_KEY = '-- remove filter --';
var REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };
var plusSegment = (React.createElement("a", { className: "gf-form-label query-part" },
    React.createElement(Icon, { name: "plus" })));
var fetchFilterKeys = function (datasource) { return __awaiter(void 0, void 0, void 0, function () {
    var ds, metrics;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getDatasourceSrv().get(datasource)];
            case 1:
                ds = _a.sent();
                if (!ds || !ds.getTagKeys) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, ds.getTagKeys()];
            case 2:
                metrics = _a.sent();
                return [2 /*return*/, metrics.map(function (m) { return ({ label: m.text, value: m.text }); })];
        }
    });
}); };
var fetchFilterKeysWithRemove = function (datasource) { return __awaiter(void 0, void 0, void 0, function () {
    var keys;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetchFilterKeys(datasource)];
            case 1:
                keys = _a.sent();
                return [2 /*return*/, __spreadArray([REMOVE_VALUE], __read(keys), false)];
        }
    });
}); };
//# sourceMappingURL=AdHocFilterKey.js.map