import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { Alert, Button, HorizontalGroup, Modal, useStyles2 } from '@grafana/ui';
import { OldFolderPicker } from 'app/core/components/Select/OldFolderPicker';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { moveDashboards, moveFolders } from 'app/features/manage-dashboards/state/actions';
import { GENERAL_FOLDER_UID } from '../../constants';
export const MoveToFolderModal = ({ results, onMoveItems, onDismiss }) => {
    var _a, _b;
    const [folder, setFolder] = useState(null);
    const styles = useStyles2(getStyles);
    const notifyApp = useAppNotification();
    const [moving, setMoving] = useState(false);
    const nestedFoldersEnabled = config.featureToggles.nestedFolders;
    const selectedDashboards = Array.from((_a = results.get('dashboard')) !== null && _a !== void 0 ? _a : []);
    const selectedFolders = nestedFoldersEnabled
        ? Array.from((_b = results.get('folder')) !== null && _b !== void 0 ? _b : []).filter((v) => v !== GENERAL_FOLDER_UID)
        : [];
    const handleFolderChange = useCallback((newFolder) => {
        setFolder(newFolder);
    }, [setFolder]);
    const moveTo = () => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d;
        if (!folder) {
            return;
        }
        if (nestedFoldersEnabled) {
            setMoving(true);
            let totalCount = 0;
            let successCount = 0;
            if (selectedDashboards.length) {
                const moveDashboardsResult = yield moveDashboards(selectedDashboards, folder);
                totalCount += moveDashboardsResult.totalCount;
                successCount += moveDashboardsResult.successCount;
            }
            if (selectedFolders.length) {
                const moveFoldersResult = yield moveFolders(selectedFolders, folder);
                totalCount += moveFoldersResult.totalCount;
                successCount += moveFoldersResult.successCount;
            }
            const destTitle = (_c = folder.title) !== null && _c !== void 0 ? _c : 'General';
            notifyNestedMoveResult(notifyApp, destTitle, {
                selectedDashboardsCount: selectedDashboards.length,
                selectedFoldersCount: selectedFolders.length,
                totalCount,
                successCount,
            });
            onMoveItems();
            setMoving(false);
            onDismiss();
            return;
        }
        if (selectedDashboards.length) {
            const folderTitle = (_d = folder.title) !== null && _d !== void 0 ? _d : 'General';
            setMoving(true);
            moveDashboards(selectedDashboards, folder).then((result) => {
                if (result.successCount > 0) {
                    const ending = result.successCount === 1 ? '' : 's';
                    const header = `Dashboard${ending} Moved`;
                    const msg = `${result.successCount} dashboard${ending} moved to ${folderTitle}`;
                    notifyApp.success(header, msg);
                }
                if (result.totalCount === result.alreadyInFolderCount) {
                    notifyApp.error('Error', `Dashboard already belongs to folder ${folderTitle}`);
                }
                else {
                    //update the list
                    onMoveItems();
                }
                setMoving(false);
                onDismiss();
            });
        }
    });
    const thingsMoving = [
        ['folder', 'folders', selectedFolders.length],
        ['dashboard', 'dashboards', selectedDashboards.length],
    ]
        .filter(([single, plural, count]) => count > 0)
        .map(([single, plural, count]) => `${count.toLocaleString()} ${count === 1 ? single : plural}`)
        .join(' and ');
    return (React.createElement(Modal, { isOpen: true, className: styles.modal, title: nestedFoldersEnabled ? 'Move' : 'Choose Dashboard Folder', icon: "folder-plus", onDismiss: onDismiss },
        React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.content },
                nestedFoldersEnabled && selectedFolders.length > 0 && (React.createElement(Alert, { severity: "warning", title: " Moving this item may change its permissions" })),
                React.createElement("p", null,
                    "Move ",
                    thingsMoving,
                    " to:"),
                React.createElement(OldFolderPicker, { allowEmpty: true, enableCreateNew: false, onChange: handleFolderChange })),
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
                React.createElement(Button, { icon: moving ? 'fa fa-spinner' : undefined, variant: "primary", onClick: moveTo }, "Move")))));
};
function notifyNestedMoveResult(notifyApp, destinationName, { selectedDashboardsCount, selectedFoldersCount, totalCount, successCount }) {
    let objectMoving;
    const plural = successCount === 1 ? '' : 's';
    const failedCount = totalCount - successCount;
    if (selectedDashboardsCount && selectedFoldersCount) {
        objectMoving = `Item${plural}`;
    }
    else if (selectedDashboardsCount) {
        objectMoving = `Dashboard${plural}`;
    }
    else if (selectedFoldersCount) {
        objectMoving = `Folder${plural}`;
    }
    if (objectMoving) {
        const objectLower = objectMoving === null || objectMoving === void 0 ? void 0 : objectMoving.toLocaleLowerCase();
        if (totalCount === successCount) {
            notifyApp.success(`${objectMoving} moved`, `Moved ${successCount} ${objectLower} to ${destinationName}`);
        }
        else if (successCount === 0) {
            notifyApp.error(`Failed to move ${objectLower}`, `Could not move ${totalCount} ${objectLower} due to an error`);
        }
        else {
            notifyApp.warning(`Partially moved ${objectLower}`, `Failed to move ${failedCount} ${objectLower} to ${destinationName}`);
        }
    }
}
const getStyles = (theme) => {
    return {
        modal: css `
      width: 500px;
    `,
        content: css `
      margin-bottom: ${theme.spacing(3)};
    `,
    };
};
//# sourceMappingURL=MoveToFolderModal.js.map