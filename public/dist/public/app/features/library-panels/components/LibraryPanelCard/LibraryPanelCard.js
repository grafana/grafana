import { css } from '@emotion/css';
import React, { useState } from 'react';
import { config } from '@grafana/runtime';
import { Icon, Link, useStyles2 } from '@grafana/ui';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { PanelTypeCard } from 'app/features/panel/components/VizTypePicker/PanelTypeCard';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';
export const LibraryPanelCard = ({ libraryPanel, onClick, onDelete, showSecondaryActions }) => {
    var _a;
    const [showDeletionModal, setShowDeletionModal] = useState(false);
    const onDeletePanel = () => {
        onDelete === null || onDelete === void 0 ? void 0 : onDelete(libraryPanel);
        setShowDeletionModal(false);
    };
    const panelPlugin = (_a = config.panels[libraryPanel.model.type]) !== null && _a !== void 0 ? _a : getPanelPluginNotFound(libraryPanel.model.type).meta;
    return (React.createElement(React.Fragment, null,
        React.createElement(PanelTypeCard, { isCurrent: false, title: libraryPanel.name, description: libraryPanel.description, plugin: panelPlugin, onClick: () => onClick === null || onClick === void 0 ? void 0 : onClick(libraryPanel), onDelete: showSecondaryActions ? () => setShowDeletionModal(true) : undefined },
            React.createElement(FolderLink, { libraryPanel: libraryPanel })),
        showDeletionModal && (React.createElement(DeleteLibraryPanelModal, { libraryPanel: libraryPanel, onConfirm: onDeletePanel, onDismiss: () => setShowDeletionModal(false) }))));
};
function FolderLink({ libraryPanel }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    if (!((_a = libraryPanel.meta) === null || _a === void 0 ? void 0 : _a.folderUid) && !((_b = libraryPanel.meta) === null || _b === void 0 ? void 0 : _b.folderName)) {
        return null;
    }
    if (!libraryPanel.meta.folderUid) {
        return (React.createElement("span", { className: styles.metaContainer },
            React.createElement(Icon, { name: 'folder', size: "sm" }),
            React.createElement("span", null, libraryPanel.meta.folderName)));
    }
    return (React.createElement("span", { className: styles.metaContainer },
        React.createElement(Link, { href: `/dashboards/f/${libraryPanel.meta.folderUid}` },
            React.createElement(Icon, { name: 'folder-upload', size: "sm" }),
            React.createElement("span", null, libraryPanel.meta.folderName))));
}
function getStyles(theme) {
    return {
        metaContainer: css `
      display: flex;
      align-items: center;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      padding-top: ${theme.spacing(0.5)};

      svg {
        margin-right: ${theme.spacing(0.5)};
        margin-bottom: 3px;
      }
    `,
    };
}
//# sourceMappingURL=LibraryPanelCard.js.map