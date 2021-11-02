import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { ConfirmModal, stylesFactory, useTheme } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { getCheckedUids } from '../utils';
import { deleteFoldersAndDashboards } from 'app/features/manage-dashboards/state/actions';
export var ConfirmDeleteModal = function (_a) {
    var results = _a.results, onDeleteItems = _a.onDeleteItems, isOpen = _a.isOpen, onDismiss = _a.onDismiss;
    var theme = useTheme();
    var styles = getStyles(theme);
    var uids = getCheckedUids(results);
    var folders = uids.folders, dashboards = uids.dashboards;
    var folderCount = folders.length;
    var dashCount = dashboards.length;
    var text = 'Do you want to delete the ';
    var subtitle;
    var dashEnding = dashCount === 1 ? '' : 's';
    var folderEnding = folderCount === 1 ? '' : 's';
    if (folderCount > 0 && dashCount > 0) {
        text += "selected folder" + folderEnding + " and dashboard" + dashEnding + "?\n";
        subtitle = "All dashboards and alerts of the selected folder" + folderEnding + " will also be deleted";
    }
    else if (folderCount > 0) {
        text += "selected folder" + folderEnding + " and all their dashboards and alerts?";
    }
    else {
        text += "selected dashboard" + dashEnding + "?";
    }
    var deleteItems = function () {
        deleteFoldersAndDashboards(folders, dashboards).then(function () {
            onDismiss();
            // Redirect to /dashboard in case folder was deleted from f/:folder.uid
            getLocationSrv().update({ path: '/dashboards' });
            onDeleteItems(folders, dashboards);
        });
    };
    return isOpen ? (React.createElement(ConfirmModal, { isOpen: isOpen, title: "Delete", body: React.createElement(React.Fragment, null,
            text,
            " ",
            subtitle && React.createElement("div", { className: styles.subtitle }, subtitle)), confirmText: "Delete", onConfirm: deleteItems, onDismiss: onDismiss })) : null;
};
var getStyles = stylesFactory(function (theme) {
    return {
        subtitle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      padding-top: ", ";\n    "], ["\n      font-size: ", ";\n      padding-top: ", ";\n    "])), theme.typography.size.base, theme.spacing.md),
    };
});
var templateObject_1;
//# sourceMappingURL=ConfirmDeleteModal.js.map