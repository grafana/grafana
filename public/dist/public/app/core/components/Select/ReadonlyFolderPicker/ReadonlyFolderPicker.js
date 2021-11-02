import { __awaiter, __generator, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import debouncePromise from 'debounce-promise';
import { selectors } from '@grafana/e2e-selectors';
import { AsyncSelect } from '@grafana/ui';
import { PermissionLevelString } from '../../../../types';
import { findOptionWithId, getFolderAsOption, getFoldersAsOptions } from './api';
import { GENERAL_FOLDER_ID, GENERAL_FOLDER_TITLE } from '../../../../features/search/constants';
export var ALL_FOLDER = { id: undefined, title: 'All' };
export var GENERAL_FOLDER = { id: GENERAL_FOLDER_ID, title: GENERAL_FOLDER_TITLE };
export function ReadonlyFolderPicker(_a) {
    var _this = this;
    var propsOnChange = _a.onChange, _b = _a.extraFolders, extraFolders = _b === void 0 ? [] : _b, initialFolderId = _a.initialFolderId, _c = _a.permissionLevel, permissionLevel = _c === void 0 ? PermissionLevelString.View : _c;
    var _d = __read(useState(false), 2), initialized = _d[0], setInitialized = _d[1];
    var _e = __read(useState(undefined), 2), option = _e[0], setOption = _e[1];
    var _f = __read(useState(undefined), 2), options = _f[0], setOptions = _f[1];
    var initialize = useCallback(function (options) { return __awaiter(_this, void 0, void 0, function () {
        var option;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    option = findOptionWithId(options, initialFolderId);
                    if (!!option) return [3 /*break*/, 2];
                    return [4 /*yield*/, getFolderAsOption(initialFolderId)];
                case 1:
                    // we didn't find the option with the initialFolderId
                    // might be because the folder doesn't exist any longer
                    // might be because the folder is outside of the search limit of the api
                    option = (_a = (_b.sent())) !== null && _a !== void 0 ? _a : options[0]; // get folder by id or select the first item in the options and call propsOnChange
                    propsOnChange(option.value);
                    _b.label = 2;
                case 2:
                    setInitialized(true);
                    setOptions(options);
                    setOption(option);
                    return [2 /*return*/];
            }
        });
    }); }, [initialFolderId, propsOnChange]);
    var loadOptions = useCallback(function (query) { return __awaiter(_this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getFoldersAsOptions({ query: query, permissionLevel: permissionLevel, extraFolders: extraFolders })];
                case 1:
                    options = _a.sent();
                    if (!!initialized) return [3 /*break*/, 3];
                    return [4 /*yield*/, initialize(options)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, options];
            }
        });
    }); }, [permissionLevel, extraFolders, initialized, initialize]);
    var debouncedLoadOptions = debouncePromise(loadOptions, 300, { leading: true });
    var onChange = useCallback(function (_a) {
        var value = _a.value;
        var option = findOptionWithId(options, value === null || value === void 0 ? void 0 : value.id);
        setOption(option);
        propsOnChange(value);
    }, [options, propsOnChange]);
    return (React.createElement("div", { "data-testid": selectors.components.ReadonlyFolderPicker.container },
        React.createElement(AsyncSelect, { menuShouldPortal: true, loadingMessage: "Loading folders...", defaultOptions: true, defaultValue: option, value: option, loadOptions: debouncedLoadOptions, onChange: onChange })));
}
//# sourceMappingURL=ReadonlyFolderPicker.js.map