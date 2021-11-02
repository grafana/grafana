import React from 'react';
import { AddLibraryPanelContents } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
export var ShareLibraryPanel = function (_a) {
    var panel = _a.panel, initialFolderId = _a.initialFolderId, onDismiss = _a.onDismiss;
    if (!panel) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("p", { className: "share-modal-info-text" }, "Create library panel."),
        React.createElement(AddLibraryPanelContents, { panel: panel, initialFolderId: initialFolderId, onDismiss: onDismiss })));
};
//# sourceMappingURL=ShareLibraryPanel.js.map