import { __awaiter, __rest } from "tslib";
import React, { useState } from 'react';
import { Space } from '@grafana/experimental';
import { Alert, Button, Field, Modal, Text } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { DescendantCount } from './DescendantCount';
export const MoveModal = (_a) => {
    var { onConfirm, onDismiss, selectedItems } = _a, props = __rest(_a, ["onConfirm", "onDismiss", "selectedItems"]);
    const [moveTarget, setMoveTarget] = useState();
    const [isMoving, setIsMoving] = useState(false);
    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    const onMove = () => __awaiter(void 0, void 0, void 0, function* () {
        if (moveTarget !== undefined) {
            setIsMoving(true);
            try {
                yield onConfirm(moveTarget);
                setIsMoving(false);
                onDismiss();
            }
            catch (_b) {
                setIsMoving(false);
            }
        }
    });
    return (React.createElement(Modal, Object.assign({ title: t('browse-dashboards.action.move-modal-title', 'Move'), onDismiss: onDismiss }, props),
        selectedFolders.length > 0 && (React.createElement(Alert, { severity: "info", title: t('browse-dashboards.action.move-modal-alert', 'Moving this item may change its permissions.') })),
        React.createElement(Text, { element: "p" },
            React.createElement(Trans, { i18nKey: "browse-dashboards.action.move-modal-text" }, "This action will move the following content:")),
        React.createElement(DescendantCount, { selectedItems: selectedItems }),
        React.createElement(Space, { v: 3 }),
        React.createElement(Field, { label: t('browse-dashboards.action.move-modal-field-label', 'Folder name') },
            React.createElement(FolderPicker, { value: moveTarget, excludeUIDs: selectedFolders, onChange: setMoveTarget })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { onClick: onDismiss, variant: "secondary", fill: "outline" },
                React.createElement(Trans, { i18nKey: "browse-dashboards.action.cancel-button" }, "Cancel")),
            React.createElement(Button, { disabled: moveTarget === undefined || isMoving, onClick: onMove, variant: "primary" }, isMoving
                ? t('browse-dashboards.action.moving', 'Moving...')
                : t('browse-dashboards.action.move-button', 'Move')))));
};
//# sourceMappingURL=MoveModal.js.map