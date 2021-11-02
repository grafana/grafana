import { __awaiter, __generator, __read, __rest } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Field, Input, Modal } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { usePanelSave } from '../../utils/usePanelSave';
import { useAsync, useDebounce } from 'react-use';
import { getLibraryPanelByName } from '../../state/api';
export var AddLibraryPanelContents = function (_a) {
    var panel = _a.panel, initialFolderId = _a.initialFolderId, onDismiss = _a.onDismiss;
    var _b = __read(useState(initialFolderId), 2), folderId = _b[0], setFolderId = _b[1];
    var _c = __read(useState(panel.title), 2), panelName = _c[0], setPanelName = _c[1];
    var _d = __read(useState(panel.title), 2), debouncedPanelName = _d[0], setDebouncedPanelName = _d[1];
    var _e = __read(useState(false), 2), waiting = _e[0], setWaiting = _e[1];
    useEffect(function () { return setWaiting(true); }, [panelName]);
    useDebounce(function () { return setDebouncedPanelName(panelName); }, 350, [panelName]);
    var saveLibraryPanel = usePanelSave().saveLibraryPanel;
    var onCreate = useCallback(function () {
        panel.libraryPanel = { uid: undefined, name: panelName };
        saveLibraryPanel(panel, folderId).then(function (res) {
            if (!(res instanceof Error)) {
                onDismiss();
            }
        });
    }, [panel, panelName, folderId, onDismiss, saveLibraryPanel]);
    var isValidName = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    return [4 /*yield*/, getLibraryPanelByName(panelName)];
                case 1: return [2 /*return*/, !(_a.sent()).some(function (lp) { return lp.folderId === folderId; })];
                case 2:
                    err_1 = _a.sent();
                    err_1.isHandled = true;
                    return [2 /*return*/, true];
                case 3:
                    setWaiting(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [debouncedPanelName, folderId]);
    var invalidInput = !(isValidName === null || isValidName === void 0 ? void 0 : isValidName.value) && isValidName.value !== undefined && panelName === debouncedPanelName && !waiting;
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Library panel name", invalid: invalidInput, error: invalidInput ? 'Library panel with this name already exists' : '' },
            React.createElement(Input, { id: "share-panel-library-panel-name-input", name: "name", value: panelName, onChange: function (e) { return setPanelName(e.currentTarget.value); } })),
        React.createElement(Field, { label: "Save in folder", description: "Library panel permissions are derived from the folder permissions" },
            React.createElement(FolderPicker, { onChange: function (_a) {
                    var id = _a.id;
                    return setFolderId(id);
                }, initialFolderId: initialFolderId, inputId: "share-panel-library-panel-folder-picker" })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
            React.createElement(Button, { onClick: onCreate, disabled: invalidInput }, "Create library panel"))));
};
export var AddLibraryPanelModal = function (_a) {
    var _b = _a.isOpen, isOpen = _b === void 0 ? false : _b, panel = _a.panel, initialFolderId = _a.initialFolderId, props = __rest(_a, ["isOpen", "panel", "initialFolderId"]);
    return (React.createElement(Modal, { title: "Create library panel", isOpen: isOpen, onDismiss: props.onDismiss },
        React.createElement(AddLibraryPanelContents, { panel: panel, initialFolderId: initialFolderId, onDismiss: props.onDismiss })));
};
//# sourceMappingURL=AddLibraryPanelModal.js.map