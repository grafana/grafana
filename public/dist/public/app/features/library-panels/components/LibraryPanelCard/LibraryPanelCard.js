import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Icon, Link, useStyles2 } from '@grafana/ui';
import { PanelTypeCard } from 'app/features/panel/components/VizTypePicker/PanelTypeCard';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';
import { config } from '@grafana/runtime';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
export var LibraryPanelCard = function (_a) {
    var _b;
    var libraryPanel = _a.libraryPanel, onClick = _a.onClick, onDelete = _a.onDelete, showSecondaryActions = _a.showSecondaryActions;
    var _c = __read(useState(false), 2), showDeletionModal = _c[0], setShowDeletionModal = _c[1];
    var onDeletePanel = function () {
        onDelete === null || onDelete === void 0 ? void 0 : onDelete(libraryPanel);
        setShowDeletionModal(false);
    };
    var panelPlugin = (_b = config.panels[libraryPanel.model.type]) !== null && _b !== void 0 ? _b : getPanelPluginNotFound(libraryPanel.model.type).meta;
    return (React.createElement(React.Fragment, null,
        React.createElement(PanelTypeCard, { isCurrent: false, title: libraryPanel.name, description: libraryPanel.description, plugin: panelPlugin, onClick: function () { return onClick === null || onClick === void 0 ? void 0 : onClick(libraryPanel); }, onDelete: showSecondaryActions ? function () { return setShowDeletionModal(true); } : undefined },
            React.createElement(FolderLink, { libraryPanel: libraryPanel })),
        showDeletionModal && (React.createElement(DeleteLibraryPanelModal, { libraryPanel: libraryPanel, onConfirm: onDeletePanel, onDismiss: function () { return setShowDeletionModal(false); } }))));
};
function FolderLink(_a) {
    var libraryPanel = _a.libraryPanel;
    var styles = useStyles2(getStyles);
    if (!libraryPanel.meta.folderUid && !libraryPanel.meta.folderName) {
        return null;
    }
    if (!libraryPanel.meta.folderUid) {
        return (React.createElement("span", { className: styles.metaContainer },
            React.createElement(Icon, { name: 'folder', size: "sm" }),
            React.createElement("span", null, libraryPanel.meta.folderName)));
    }
    return (React.createElement("span", { className: styles.metaContainer },
        React.createElement(Link, { href: "/dashboards/f/" + libraryPanel.meta.folderUid },
            React.createElement(Icon, { name: 'folder-upload', size: "sm" }),
            React.createElement("span", null, libraryPanel.meta.folderName))));
}
function getStyles(theme) {
    return {
        metaContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      color: ", ";\n      font-size: ", ";\n      padding-top: ", ";\n\n      svg {\n        margin-right: ", ";\n        margin-bottom: 3px;\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      color: ", ";\n      font-size: ", ";\n      padding-top: ", ";\n\n      svg {\n        margin-right: ", ";\n        margin-bottom: 3px;\n      }\n    "])), theme.colors.text.secondary, theme.typography.bodySmall.fontSize, theme.spacing(0.5), theme.spacing(0.5)),
    };
}
var templateObject_1;
//# sourceMappingURL=LibraryPanelCard.js.map