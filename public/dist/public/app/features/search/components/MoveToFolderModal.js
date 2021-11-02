import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Button, HorizontalGroup, Modal, stylesFactory, useTheme } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import appEvents from 'app/core/app_events';
import { getCheckedDashboards } from '../utils';
import { moveDashboards } from 'app/features/manage-dashboards/state/actions';
export var MoveToFolderModal = function (_a) {
    var results = _a.results, onMoveItems = _a.onMoveItems, isOpen = _a.isOpen, onDismiss = _a.onDismiss;
    var _b = __read(useState(null), 2), folder = _b[0], setFolder = _b[1];
    var theme = useTheme();
    var styles = getStyles(theme);
    var selectedDashboards = getCheckedDashboards(results);
    var moveTo = function () {
        var _a;
        if (folder && selectedDashboards.length) {
            var folderTitle_1 = (_a = folder.title) !== null && _a !== void 0 ? _a : 'General';
            moveDashboards(selectedDashboards.map(function (d) { return d.uid; }), folder).then(function (result) {
                if (result.successCount > 0) {
                    var ending = result.successCount === 1 ? '' : 's';
                    var header = "Dashboard" + ending + " Moved";
                    var msg = result.successCount + " dashboard" + ending + " moved to " + folderTitle_1;
                    appEvents.emit(AppEvents.alertSuccess, [header, msg]);
                }
                if (result.totalCount === result.alreadyInFolderCount) {
                    appEvents.emit(AppEvents.alertError, ['Error', "Dashboard already belongs to folder " + folderTitle_1]);
                }
                else {
                    onMoveItems(selectedDashboards, folder);
                }
                onDismiss();
            });
        }
    };
    return isOpen ? (React.createElement(Modal, { className: styles.modal, title: "Choose Dashboard Folder", icon: "folder-plus", isOpen: isOpen, onDismiss: onDismiss },
        React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.content },
                React.createElement("p", null,
                    "Move the ",
                    selectedDashboards.length,
                    " selected dashboard",
                    selectedDashboards.length === 1 ? '' : 's',
                    " to the following folder:"),
                React.createElement(FolderPicker, { onChange: function (f) { return setFolder(f); } })),
            React.createElement(HorizontalGroup, { justify: "center" },
                React.createElement(Button, { variant: "primary", onClick: moveTo }, "Move"),
                React.createElement(Button, { variant: "secondary", onClick: onDismiss }, "Cancel"))))) : null;
};
var getStyles = stylesFactory(function (theme) {
    return {
        modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 500px;\n    "], ["\n      width: 500px;\n    "]))),
        content: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.lg),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=MoveToFolderModal.js.map