import { __awaiter, __rest } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import { isFetchError } from '@grafana/runtime';
import { Button, Field, Input, Modal } from '@grafana/ui';
import { OldFolderPicker } from 'app/core/components/Select/OldFolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { getLibraryPanelByName } from '../../state/api';
import { usePanelSave } from '../../utils/usePanelSave';
export const AddLibraryPanelContents = ({ panel, initialFolderUid, onDismiss }) => {
    const [folderUid, setFolderUid] = useState(initialFolderUid);
    const [panelName, setPanelName] = useState(panel.title);
    const [debouncedPanelName, setDebouncedPanelName] = useState(panel.title);
    const [waiting, setWaiting] = useState(false);
    useEffect(() => setWaiting(true), [panelName]);
    useDebounce(() => setDebouncedPanelName(panelName), 350, [panelName]);
    const { saveLibraryPanel } = usePanelSave();
    const onCreate = useCallback(() => {
        panel.libraryPanel = { uid: '', name: panelName };
        saveLibraryPanel(panel, folderUid).then((res) => {
            if (!(res instanceof Error)) {
                onDismiss();
            }
        });
    }, [panel, panelName, folderUid, onDismiss, saveLibraryPanel]);
    const isValidName = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return !(yield getLibraryPanelByName(panelName)).some((lp) => lp.folderUid === folderUid);
        }
        catch (err) {
            if (isFetchError(err)) {
                err.isHandled = true;
            }
            return true;
        }
        finally {
            setWaiting(false);
        }
    }), [debouncedPanelName, folderUid]);
    const invalidInput = !(isValidName === null || isValidName === void 0 ? void 0 : isValidName.value) && isValidName.value !== undefined && panelName === debouncedPanelName && !waiting;
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: t('library-panel.add-modal.name', 'Library panel name'), invalid: invalidInput, error: invalidInput ? t('library-panel.add-modal.error', 'Library panel with this name already exists') : '' },
            React.createElement(Input, { id: "share-panel-library-panel-name-input", name: "name", value: panelName, onChange: (e) => setPanelName(e.currentTarget.value) })),
        React.createElement(Field, { label: t('library-panel.add-modal.folder', 'Save in folder'), description: t('library-panel.add-modal.folder-description', 'Library panel permissions are derived from the folder permissions') },
            React.createElement(OldFolderPicker, { onChange: ({ uid }) => setFolderUid(uid), initialFolderUid: initialFolderUid, inputId: "share-panel-library-panel-folder-picker" })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" },
                React.createElement(Trans, { i18nKey: "library-panel.add-modal.cancel" }, "Cancel")),
            React.createElement(Button, { onClick: onCreate, disabled: invalidInput },
                React.createElement(Trans, { i18nKey: "library-panel.add-modal.create" }, "Create library panel")))));
};
export const AddLibraryPanelModal = (_a) => {
    var { isOpen = false, panel, initialFolderUid } = _a, props = __rest(_a, ["isOpen", "panel", "initialFolderUid"]);
    return (React.createElement(Modal, { title: "Create library panel", isOpen: isOpen, onDismiss: props.onDismiss },
        React.createElement(AddLibraryPanelContents, { panel: panel, initialFolderUid: initialFolderUid, onDismiss: props.onDismiss })));
};
//# sourceMappingURL=AddLibraryPanelModal.js.map