import React, { useState } from 'react';
import { Button, HorizontalGroup, IconButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { GENERAL_FOLDER_UID } from '../../constants';
import { getStyles } from './ActionRow';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';
export function ManageActions({ items, folder, onChange, clearSelection }) {
    var _a;
    const styles = useStyles2(getStyles);
    const canSave = folder === null || folder === void 0 ? void 0 : folder.canSave;
    const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;
    const canMove = hasEditPermissionInFolders;
    const selectedFolders = Array.from((_a = items.get('folder')) !== null && _a !== void 0 ? _a : []);
    const includesGeneralFolder = selectedFolders.find((result) => result === GENERAL_FOLDER_UID);
    const canDelete = hasEditPermissionInFolders && !includesGeneralFolder;
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const onMove = () => {
        setIsMoveModalOpen(true);
    };
    const onDelete = () => {
        setIsDeleteModalOpen(true);
    };
    return (React.createElement("div", { className: styles.actionRow, "data-testid": "manage-actions" },
        React.createElement(HorizontalGroup, { spacing: "md", width: "auto" },
            React.createElement(IconButton, { name: "check-square", onClick: clearSelection, tooltip: "Uncheck everything" }),
            React.createElement(Button, { disabled: !canMove, onClick: onMove, icon: "exchange-alt", variant: "secondary" }, "Move"),
            React.createElement(Button, { disabled: !canDelete, onClick: onDelete, icon: "trash-alt", variant: "destructive" }, "Delete")),
        isDeleteModalOpen && (React.createElement(ConfirmDeleteModal, { onDeleteItems: onChange, results: items, onDismiss: () => setIsDeleteModalOpen(false) })),
        isMoveModalOpen && (React.createElement(MoveToFolderModal, { onMoveItems: onChange, results: items, onDismiss: () => setIsMoveModalOpen(false) }))));
}
//# sourceMappingURL=ManageActions.js.map