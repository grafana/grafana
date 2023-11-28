import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAsync } from 'react-use';
import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, Input, AsyncVirtualizedSelect } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { createFolder, getFolderByUid, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { AccessControlAction, PermissionLevelString } from 'app/types';
export const ADD_NEW_FOLER_OPTION = '+ Add new';
const VALUE_FOR_ADD = '-10';
export function OldFolderPicker(props) {
    var _a;
    const { dashboardId, allowEmpty, onChange, filter, enableCreateNew, inputId, onClear, enableReset, initialFolderUid, initialTitle = '', permissionLevel = PermissionLevelString.Edit, rootName: rootNameProp, showRoot = true, skipInitialLoad, searchQueryType, customAdd, folderWarning, } = props;
    const rootName = (rootNameProp !== null && rootNameProp !== void 0 ? rootNameProp : newBrowseDashboardsEnabled()) ? 'Dashboards' : 'General';
    const [folder, setFolder] = useState(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [newFolderValue, setNewFolderValue] = useState((_a = folder === null || folder === void 0 ? void 0 : folder.title) !== null && _a !== void 0 ? _a : '');
    const styles = useStyles2(getStyles);
    const isClearable = typeof onClear === 'function';
    const getOptions = useCallback((query) => __awaiter(this, void 0, void 0, function* () {
        const searchHits = yield searchFolders(query, permissionLevel, searchQueryType);
        const resultsAfterMapAndFilter = mapSearchHitsToOptions(searchHits, filter);
        const options = resultsAfterMapAndFilter;
        reportInteraction('grafana_folder_picker_results_loaded', {
            results: options.length,
            searchTermLength: query.length,
            enableCreateNew: Boolean(enableCreateNew),
        });
        const hasAccess = contextSrv.hasPermission(AccessControlAction.DashboardsWrite) ||
            contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
        if (hasAccess && (rootName === null || rootName === void 0 ? void 0 : rootName.toLowerCase().startsWith(query.toLowerCase())) && showRoot) {
            options.unshift({ label: rootName, value: '' });
        }
        if (enableReset &&
            query === '' &&
            initialTitle !== '' &&
            !options.find((option) => option.label === initialTitle)) {
            options.unshift({ label: initialTitle, value: initialFolderUid });
        }
        if (enableCreateNew && Boolean(customAdd)) {
            return [...options, { value: VALUE_FOR_ADD, label: ADD_NEW_FOLER_OPTION, title: query }];
        }
        else {
            return options;
        }
    }), [
        enableReset,
        initialFolderUid,
        initialTitle,
        permissionLevel,
        rootName,
        showRoot,
        searchQueryType,
        filter,
        enableCreateNew,
        customAdd,
    ]);
    const debouncedSearch = useMemo(() => {
        return debounce(getOptions, 300, { leading: true });
    }, [getOptions]);
    const loadInitialValue = () => __awaiter(this, void 0, void 0, function* () {
        const resetFolder = { label: initialTitle, value: undefined };
        const rootFolder = { label: rootName, value: '' };
        const options = yield getOptions('');
        let folder = null;
        if (initialFolderUid !== undefined && initialFolderUid !== null) {
            folder = options.find((option) => option.value === initialFolderUid) || null;
        }
        else if (enableReset && initialTitle) {
            folder = resetFolder;
        }
        else if (initialFolderUid) {
            folder = options.find((option) => option.id === initialFolderUid) || null;
        }
        if (!folder && !allowEmpty) {
            if (contextSrv.isEditor) {
                folder = rootFolder;
            }
            else {
                // We shouldn't assign a random folder without the user actively choosing it on a persisted dashboard
                const isPersistedDashBoard = !!dashboardId;
                if (isPersistedDashBoard) {
                    folder = resetFolder;
                }
                else {
                    folder = options.length > 0 ? options[0] : resetFolder;
                }
            }
        }
        !isCreatingNew && setFolder(folder);
    });
    useEffect(() => {
        // if this is not the same as our initial value notify parent
        if (folder && folder.value !== initialFolderUid) {
            !isCreatingNew && folder.value && folder.label && onChange({ uid: folder.value, title: folder.label });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder, initialFolderUid]);
    // initial values for dropdown
    useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (skipInitialLoad) {
            const folder = yield getInitialValues({
                getFolder: getFolderByUid,
                folderUid: initialFolderUid,
                folderName: initialTitle,
            });
            setFolder(folder);
        }
        yield loadInitialValue();
    }), [skipInitialLoad, initialFolderUid, initialTitle]);
    useEffect(() => {
        if (folder && folder.id === VALUE_FOR_ADD) {
            setIsCreatingNew(true);
        }
    }, [folder]);
    const onFolderChange = useCallback((newFolder, actionMeta) => {
        if ((newFolder === null || newFolder === void 0 ? void 0 : newFolder.value) === VALUE_FOR_ADD) {
            setFolder({
                id: VALUE_FOR_ADD,
                title: inputValue,
            });
            setNewFolderValue(inputValue);
        }
        else {
            if (!newFolder) {
                newFolder = { value: '', label: rootName };
            }
            if (actionMeta.action === 'clear' && onClear) {
                onClear();
                return;
            }
            setFolder(newFolder);
            onChange({ uid: newFolder.value, title: newFolder.label });
        }
    }, [onChange, onClear, rootName, inputValue]);
    const createNewFolder = useCallback((folderName) => __awaiter(this, void 0, void 0, function* () {
        if (folderWarning === null || folderWarning === void 0 ? void 0 : folderWarning.warningCondition(folderName)) {
            reportInteraction('grafana_folder_picker_folder_created', { status: 'failed_condition' });
            return false;
        }
        const newFolder = yield createFolder({ title: folderName });
        let folder = { value: '', label: 'Not created' };
        if (newFolder.uid) {
            reportInteraction('grafana_folder_picker_folder_created', { status: 'success' });
            appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
            folder = { value: newFolder.uid, label: newFolder.title };
            setFolder(newFolder);
            onFolderChange(folder, { action: 'create-option', option: folder });
        }
        else {
            reportInteraction('grafana_folder_picker_folder_created', { status: 'failed' });
            appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
        }
        return folder;
    }), [folderWarning, onFolderChange]);
    const onKeyDown = useCallback((event) => {
        const dissalowValues = Boolean(customAdd === null || customAdd === void 0 ? void 0 : customAdd.disallowValues);
        if (event.key === 'Enter' && dissalowValues && !(customAdd === null || customAdd === void 0 ? void 0 : customAdd.isAllowedValue(newFolderValue))) {
            event.preventDefault();
            return;
        }
        switch (event.key) {
            case 'Enter': {
                createNewFolder(folder === null || folder === void 0 ? void 0 : folder.title);
                setIsCreatingNew(false);
                break;
            }
            case 'Escape': {
                setFolder({ value: '', label: rootName });
                setIsCreatingNew(false);
            }
        }
    }, [customAdd === null || customAdd === void 0 ? void 0 : customAdd.disallowValues, customAdd === null || customAdd === void 0 ? void 0 : customAdd.isAllowedValue, newFolderValue, createNewFolder, folder === null || folder === void 0 ? void 0 : folder.title, rootName]);
    const onNewFolderChange = (e) => {
        const value = e.currentTarget.value;
        setNewFolderValue(value);
        setFolder({ id: undefined, title: value });
    };
    const onBlur = () => {
        setFolder({ value: '', label: rootName });
        setIsCreatingNew(false);
    };
    const onInputChange = (value, { action }) => {
        if (action === 'input-change') {
            setInputValue((ant) => value);
        }
        if (action === 'menu-close') {
            setInputValue((_) => value);
        }
        return;
    };
    const FolderWarningWhenCreating = () => {
        if (folderWarning === null || folderWarning === void 0 ? void 0 : folderWarning.warningCondition(newFolderValue)) {
            return React.createElement(folderWarning.warningComponent, null);
        }
        else {
            return null;
        }
    };
    const FolderWarningWhenSearching = () => {
        if (folderWarning === null || folderWarning === void 0 ? void 0 : folderWarning.warningCondition(inputValue)) {
            return React.createElement(folderWarning.warningComponent, null);
        }
        else {
            return null;
        }
    };
    if (isCreatingNew) {
        return (React.createElement(React.Fragment, null,
            React.createElement(FolderWarningWhenCreating, null),
            React.createElement("div", { className: styles.newFolder }, "Press enter to create the new folder."),
            React.createElement(Input, { width: 30, autoFocus: true, value: newFolderValue, onChange: onNewFolderChange, onKeyDown: onKeyDown, placeholder: "Press enter to confirm new folder.", onBlur: onBlur })));
    }
    else {
        return (React.createElement("div", { "data-testid": selectors.components.FolderPicker.containerV2 },
            React.createElement(FolderWarningWhenSearching, null),
            React.createElement(AsyncVirtualizedSelect, { inputId: inputId, "aria-label": selectors.components.FolderPicker.input, loadingMessage: t('folder-picker.loading', 'Loading folders...'), defaultOptions: true, defaultValue: folder, inputValue: inputValue, onInputChange: onInputChange, value: folder, allowCustomValue: enableCreateNew && !Boolean(customAdd), loadOptions: debouncedSearch, onChange: onFolderChange, onCreateOption: createNewFolder, isClearable: isClearable })));
    }
}
function mapSearchHitsToOptions(hits, filter) {
    const filteredHits = filter ? filter(hits) : hits;
    return filteredHits.map((hit) => ({ label: hit.title, value: hit.uid }));
}
export function getInitialValues({ folderName, folderUid, getFolder }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (folderUid === null || folderUid === undefined) {
            throw new Error('folderUid is not found.');
        }
        if (folderName) {
            return { label: folderName, value: folderUid };
        }
        const folderDto = yield getFolder(folderUid);
        return { label: folderDto.title, value: folderUid };
    });
}
const getStyles = (theme) => ({
    newFolder: css `
    color: ${theme.colors.warning.main};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding-bottom: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=OldFolderPicker.js.map