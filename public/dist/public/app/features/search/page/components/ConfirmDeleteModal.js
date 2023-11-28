import { css } from '@emotion/css';
import React from 'react';
import { ConfirmModal, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { deleteFoldersAndDashboards } from 'app/features/manage-dashboards/state/actions';
export const ConfirmDeleteModal = ({ results, onDeleteItems, onDismiss }) => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const dashboards = Array.from((_a = results.get('dashboard')) !== null && _a !== void 0 ? _a : []);
    const folders = Array.from((_b = results.get('folder')) !== null && _b !== void 0 ? _b : []);
    const folderCount = folders.length;
    const dashCount = dashboards.length;
    let text = 'Do you want to delete the ';
    let subtitle;
    const dashEnding = dashCount === 1 ? '' : 's';
    const folderEnding = folderCount === 1 ? '' : 's';
    if (folderCount > 0 && dashCount > 0) {
        text += `selected folder${folderEnding} and dashboard${dashEnding}?\n`;
        subtitle = `All dashboards and alerts of the selected folder${folderEnding} will also be deleted`;
    }
    else if (folderCount > 0) {
        text += `selected folder${folderEnding} and all ${folderCount === 1 ? 'its' : 'their'} dashboards and alerts?`;
    }
    else {
        text += `${dashCount} selected dashboard${dashEnding}?`;
    }
    const deleteItems = () => {
        deleteFoldersAndDashboards(folders, dashboards).then(() => {
            onDeleteItems();
            onDismiss();
        });
    };
    const requireDoubleConfirm = config.featureToggles.nestedFolders && folderCount > 0;
    return (React.createElement(ConfirmModal, { isOpen: true, title: "Delete", body: React.createElement(React.Fragment, null,
            text,
            " ",
            subtitle && React.createElement("div", { className: styles.subtitle }, subtitle)), confirmText: "Delete", confirmationText: requireDoubleConfirm ? 'delete' : undefined, onConfirm: deleteItems, onDismiss: onDismiss }));
};
const getStyles = (theme) => ({
    subtitle: css `
    font-size: ${theme.typography.fontSize}px;
    padding-top: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=ConfirmDeleteModal.js.map