import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Dropdown, Icon, Menu, MenuItem } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';
import { appEvents } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { ShowModalReactEvent } from 'app/types/events';
import { useDeleteFolderMutation, useMoveFolderMutation } from '../api/browseDashboardsAPI';
import { getFolderPermissions } from '../permissions';
import { DeleteModal } from './BrowseActions/DeleteModal';
import { MoveModal } from './BrowseActions/MoveModal';
export function FolderActionsButton({ folder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
    const [moveFolder] = useMoveFolderMutation();
    const [deleteFolder] = useDeleteFolderMutation();
    const { canEditFolders, canDeleteFolders, canViewPermissions, canSetPermissions } = getFolderPermissions(folder);
    // Can only move folders when nestedFolders is enabled
    const canMoveFolder = config.featureToggles.nestedFolders && canEditFolders;
    const onMove = (destinationUID) => __awaiter(this, void 0, void 0, function* () {
        yield moveFolder({ folder, destinationUID });
        reportInteraction('grafana_manage_dashboards_item_moved', {
            item_counts: {
                folder: 1,
                dashboard: 0,
            },
            source: 'folder_actions',
        });
    });
    const onDelete = () => __awaiter(this, void 0, void 0, function* () {
        yield deleteFolder(folder);
        reportInteraction('grafana_manage_dashboards_item_deleted', {
            item_counts: {
                folder: 1,
                dashboard: 0,
            },
            source: 'folder_actions',
        });
        const { parents } = folder;
        const parentUrl = parents && parents.length ? parents[parents.length - 1].url : '/dashboards';
        locationService.push(parentUrl);
    });
    const showMoveModal = () => {
        appEvents.publish(new ShowModalReactEvent({
            component: MoveModal,
            props: {
                selectedItems: {
                    folder: { [folder.uid]: true },
                    dashboard: {},
                    panel: {},
                    $all: false,
                },
                onConfirm: onMove,
            },
        }));
    };
    const showDeleteModal = () => {
        appEvents.publish(new ShowModalReactEvent({
            component: DeleteModal,
            props: {
                selectedItems: {
                    folder: { [folder.uid]: true },
                    dashboard: {},
                    panel: {},
                    $all: false,
                },
                onConfirm: onDelete,
            },
        }));
    };
    const managePermissionsLabel = t('browse-dashboards.folder-actions-button.manage-permissions', 'Manage permissions');
    const moveLabel = t('browse-dashboards.folder-actions-button.move', 'Move');
    const deleteLabel = t('browse-dashboards.folder-actions-button.delete', 'Delete');
    const menu = (React.createElement(Menu, null,
        canViewPermissions && React.createElement(MenuItem, { onClick: () => setShowPermissionsDrawer(true), label: managePermissionsLabel }),
        canMoveFolder && React.createElement(MenuItem, { onClick: showMoveModal, label: moveLabel }),
        canDeleteFolders && React.createElement(MenuItem, { destructive: true, onClick: showDeleteModal, label: deleteLabel })));
    if (!canViewPermissions && !canMoveFolder && !canDeleteFolders) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Dropdown, { overlay: menu, onVisibleChange: setIsOpen },
            React.createElement(Button, { variant: "secondary" },
                React.createElement(Trans, { i18nKey: "browse-dashboards.folder-actions-button.folder-actions" }, "Folder actions"),
                React.createElement(Icon, { name: isOpen ? 'angle-up' : 'angle-down' }))),
        showPermissionsDrawer && (React.createElement(Drawer, { title: t('browse-dashboards.action.manage-permissions-button', 'Manage permissions'), subtitle: folder.title, onClose: () => setShowPermissionsDrawer(false), size: "md" },
            React.createElement(Permissions, { resource: "folders", resourceId: folder.uid, canSetPermissions: canSetPermissions })))));
}
//# sourceMappingURL=FolderActionsButton.js.map