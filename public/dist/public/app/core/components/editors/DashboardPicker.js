import { __awaiter, __generator, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import debounce from 'debounce-promise';
import { backendSrv } from 'app/core/services/backend_srv';
import { AsyncSelect } from '@grafana/ui';
import { useAsync } from 'react-use';
var getDashboards = function (query) {
    if (query === void 0) { query = ''; }
    return backendSrv.search({ type: 'dash-db', query: query, limit: 100 }).then(function (result) {
        return result.map(function (item) {
            var _a;
            return ({
                value: item.uid,
                label: ((_a = item === null || item === void 0 ? void 0 : item.folderTitle) !== null && _a !== void 0 ? _a : 'General') + "/" + item.title,
            });
        });
    });
};
/** This will return the item UID */
export var DashboardPicker = function (_a) {
    var _b;
    var value = _a.value, onChange = _a.onChange, item = _a.item;
    var _c = __read(useState(), 2), current = _c[0], setCurrent = _c[1];
    // This is required because the async select does not match the raw uid value
    // We can not use a simple Select because the dashboard search should not return *everything*
    useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!value) {
                        setCurrent(undefined);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, backendSrv.getDashboardByUid(value)];
                case 1:
                    res = _c.sent();
                    setCurrent({
                        value: res.dashboard.uid,
                        label: ((_b = (_a = res.meta) === null || _a === void 0 ? void 0 : _a.folderTitle) !== null && _b !== void 0 ? _b : 'General') + "/" + res.dashboard.title,
                    });
                    return [2 /*return*/, undefined];
            }
        });
    }); }, [value]);
    var onPicked = useCallback(function (sel) {
        onChange(sel === null || sel === void 0 ? void 0 : sel.value);
    }, [onChange]);
    var debouncedSearch = debounce(getDashboards, 300);
    var _d = (_b = item === null || item === void 0 ? void 0 : item.settings) !== null && _b !== void 0 ? _b : {}, placeholder = _d.placeholder, isClearable = _d.isClearable;
    return (React.createElement(AsyncSelect, { menuShouldPortal: true, isClearable: isClearable, defaultOptions: true, loadOptions: debouncedSearch, onChange: onPicked, placeholder: placeholder !== null && placeholder !== void 0 ? placeholder : 'Select dashboard', noOptionsMessage: "No dashboards found", value: current }));
};
//# sourceMappingURL=DashboardPicker.js.map