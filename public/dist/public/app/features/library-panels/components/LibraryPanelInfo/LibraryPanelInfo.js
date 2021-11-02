import { __makeTemplateObject } from "tslib";
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import React from 'react';
import { isPanelModelLibraryPanel } from '../../guard';
export var LibraryPanelInformation = function (_a) {
    var _b;
    var panel = _a.panel, formatDate = _a.formatDate;
    var styles = useStyles(getStyles);
    if (!isPanelModelLibraryPanel(panel)) {
        return null;
    }
    return (React.createElement("div", { className: styles.info },
        React.createElement("div", { className: styles.libraryPanelInfo }, "Used on " + panel.libraryPanel.meta.connectedDashboards + " ",
            panel.libraryPanel.meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'),
        React.createElement("div", { className: styles.libraryPanelInfo },
            "Last edited on ", (_b = formatDate === null || formatDate === void 0 ? void 0 : formatDate(panel.libraryPanel.meta.updated, 'L')) !== null && _b !== void 0 ? _b : panel.libraryPanel.meta.updated,
            " by",
            panel.libraryPanel.meta.updatedBy.avatarUrl && (React.createElement("img", { width: "22", height: "22", className: styles.userAvatar, src: panel.libraryPanel.meta.updatedBy.avatarUrl, alt: "Avatar for " + panel.libraryPanel.meta.updatedBy.name })),
            panel.libraryPanel.meta.updatedBy.name)));
};
var getStyles = function (theme) {
    return {
        info: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      line-height: 1;\n    "], ["\n      line-height: 1;\n    "]))),
        libraryPanelInfo: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n    "], ["\n      color: ", ";\n      font-size: ", ";\n    "])), theme.colors.textSemiWeak, theme.typography.size.sm),
        userAvatar: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      border-radius: 50%;\n      box-sizing: content-box;\n      width: 22px;\n      height: 22px;\n      padding-left: ", ";\n      padding-right: ", ";\n    "], ["\n      border-radius: 50%;\n      box-sizing: content-box;\n      width: 22px;\n      height: 22px;\n      padding-left: ", ";\n      padding-right: ", ";\n    "])), theme.spacing.sm, theme.spacing.sm),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LibraryPanelInfo.js.map