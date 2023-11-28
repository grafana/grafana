import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { getNewDashboardPhrase, getNewFolderPhrase, getImportPhrase, getNewPhrase, } from 'app/features/search/tempI18nPhrases';
import { useNewFolderMutation } from '../api/browseDashboardsAPI';
import { NewFolderForm } from './NewFolderForm';
export default function CreateNewButton({ parentFolder, canCreateDashboard, canCreateFolder }) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const [newFolder] = useNewFolderMutation();
    const [showNewFolderDrawer, setShowNewFolderDrawer] = useState(false);
    const onCreateFolder = (folderName) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield newFolder({
                title: folderName,
                parentUid: parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid,
            });
            const depth = (parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.parents) ? parentFolder.parents.length + 1 : 0;
            reportInteraction('grafana_manage_dashboards_folder_created', {
                is_subfolder: Boolean(parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid),
                folder_depth: depth,
            });
        }
        finally {
            setShowNewFolderDrawer(false);
        }
    });
    const newMenu = (React.createElement(Menu, null,
        canCreateDashboard && (React.createElement(MenuItem, { label: getNewDashboardPhrase(), onClick: () => reportInteraction('grafana_menu_item_clicked', {
                url: addFolderUidToUrl('/dashboard/new', parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid),
                from: location.pathname,
            }), url: addFolderUidToUrl('/dashboard/new', parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid) })),
        canCreateFolder && React.createElement(MenuItem, { onClick: () => setShowNewFolderDrawer(true), label: getNewFolderPhrase() }),
        canCreateDashboard && (React.createElement(MenuItem, { label: getImportPhrase(), onClick: () => reportInteraction('grafana_menu_item_clicked', {
                url: addFolderUidToUrl('/dashboard/import', parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid),
                from: location.pathname,
            }), url: addFolderUidToUrl('/dashboard/import', parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.uid) }))));
    return (React.createElement(React.Fragment, null,
        React.createElement(Dropdown, { overlay: newMenu, onVisibleChange: setIsOpen },
            React.createElement(Button, null,
                getNewPhrase(),
                React.createElement(Icon, { name: isOpen ? 'angle-up' : 'angle-down' }))),
        showNewFolderDrawer && (React.createElement(Drawer, { title: getNewFolderPhrase(), subtitle: (parentFolder === null || parentFolder === void 0 ? void 0 : parentFolder.title) ? `Location: ${parentFolder.title}` : undefined, onClose: () => setShowNewFolderDrawer(false), size: "sm" },
            React.createElement(NewFolderForm, { onConfirm: onCreateFolder, onCancel: () => setShowNewFolderDrawer(false) })))));
}
/**
 *
 * @param url without any parameters
 * @param folderUid  folder id
 * @returns url with paramter if folder is present
 */
function addFolderUidToUrl(url, folderUid) {
    return folderUid ? url + '?folderUid=' + folderUid : url;
}
//# sourceMappingURL=CreateNewButton.js.map