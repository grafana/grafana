import { __awaiter } from "tslib";
import debouncePromise from 'debounce-promise';
import React, { useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { AsyncSelect } from '@grafana/ui';
import { GENERAL_FOLDER_ID, GENERAL_FOLDER_TITLE } from '../../../../features/search/constants';
import { PermissionLevelString } from '../../../../types';
import { findOptionWithId, getFolderAsOption, getFoldersAsOptions } from './api';
export const ALL_FOLDER = { id: undefined, title: 'All' };
export const GENERAL_FOLDER = { id: GENERAL_FOLDER_ID, title: GENERAL_FOLDER_TITLE };
export function ReadonlyFolderPicker({ onChange: propsOnChange, extraFolders = [], initialFolderId, permissionLevel = PermissionLevelString.View, }) {
    const [initialized, setInitialized] = useState(false);
    const [option, setOption] = useState(undefined);
    const [options, setOptions] = useState(undefined);
    const initialize = useCallback((options) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        let option = findOptionWithId(options, initialFolderId);
        if (!option) {
            // we didn't find the option with the initialFolderId
            // might be because the folder doesn't exist any longer
            // might be because the folder is outside of the search limit of the api
            option = (_a = (yield getFolderAsOption(initialFolderId))) !== null && _a !== void 0 ? _a : options[0]; // get folder by id or select the first item in the options and call propsOnChange
            propsOnChange(option.value);
        }
        setInitialized(true);
        setOptions(options);
        setOption(option);
    }), [initialFolderId, propsOnChange]);
    const loadOptions = useCallback((query) => __awaiter(this, void 0, void 0, function* () {
        const options = yield getFoldersAsOptions({ query, permissionLevel, extraFolders });
        if (!initialized) {
            yield initialize(options);
        }
        return options;
    }), [permissionLevel, extraFolders, initialized, initialize]);
    const debouncedLoadOptions = debouncePromise(loadOptions, 300, { leading: true });
    const onChange = useCallback(({ value }) => {
        const option = findOptionWithId(options, value === null || value === void 0 ? void 0 : value.id);
        setOption(option);
        propsOnChange(value);
    }, [options, propsOnChange]);
    return (React.createElement("div", { "data-testid": selectors.components.ReadonlyFolderPicker.container },
        React.createElement(AsyncSelect, { loadingMessage: "Loading folders...", defaultOptions: true, defaultValue: option, value: option, loadOptions: debouncedLoadOptions, onChange: onChange })));
}
//# sourceMappingURL=ReadonlyFolderPicker.js.map