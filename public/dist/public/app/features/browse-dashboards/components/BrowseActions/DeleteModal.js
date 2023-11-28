import { __awaiter, __rest } from "tslib";
import React, { useState } from 'react';
import { Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Alert, ConfirmModal, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DescendantCount } from './DescendantCount';
export const DeleteModal = (_a) => {
    var { onConfirm, onDismiss, selectedItems } = _a, props = __rest(_a, ["onConfirm", "onDismiss", "selectedItems"]);
    const { data } = useGetAffectedItemsQuery(selectedItems);
    const deleteIsInvalid = !config.featureToggles.nestedFolders && data && (data.alertRule || data.libraryPanel);
    const [isDeleting, setIsDeleting] = useState(false);
    const onDelete = () => __awaiter(void 0, void 0, void 0, function* () {
        setIsDeleting(true);
        try {
            yield onConfirm();
            setIsDeleting(false);
            onDismiss();
        }
        catch (_b) {
            setIsDeleting(false);
        }
    });
    return (React.createElement(ConfirmModal, Object.assign({ body: React.createElement(React.Fragment, null,
            React.createElement(Text, { element: "p" },
                React.createElement(Trans, { i18nKey: "browse-dashboards.action.delete-modal-text" }, "This action will delete the following content:")),
            React.createElement(DescendantCount, { selectedItems: selectedItems }),
            React.createElement(Space, { v: 2 })), description: React.createElement(React.Fragment, null, deleteIsInvalid ? (React.createElement(Alert, { severity: "warning", title: t('browse-dashboards.action.delete-modal-invalid-title', 'Cannot delete folder') },
            React.createElement(Trans, { i18nKey: "browse-dashboards.action.delete-modal-invalid-text" }, "One or more folders contain library panels or alert rules. Delete these first in order to proceed."))) : null), confirmationText: "Delete", confirmText: isDeleting
            ? t('browse-dashboards.action.deleting', 'Deleting...')
            : t('browse-dashboards.action.delete-button', 'Delete'), onDismiss: onDismiss, onConfirm: onDelete, title: t('browse-dashboards.action.delete-modal-title', 'Delete') }, props)));
};
//# sourceMappingURL=DeleteModal.js.map