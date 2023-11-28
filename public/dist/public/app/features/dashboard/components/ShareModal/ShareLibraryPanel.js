import React, { useEffect } from 'react';
import { reportInteraction } from '@grafana/runtime/src';
import { Trans } from 'app/core/internationalization';
import { AddLibraryPanelContents } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
export const ShareLibraryPanel = ({ panel, initialFolderUid, onDismiss }) => {
    useEffect(() => {
        reportInteraction('grafana_dashboards_library_panel_share_viewed');
    }, []);
    if (!panel) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("p", { className: "share-modal-info-text" },
            React.createElement(Trans, { i18nKey: "share-modal.library.info" }, "Create library panel.")),
        React.createElement(AddLibraryPanelContents, { panel: panel, initialFolderUid: initialFolderUid, onDismiss: onDismiss })));
};
//# sourceMappingURL=ShareLibraryPanel.js.map