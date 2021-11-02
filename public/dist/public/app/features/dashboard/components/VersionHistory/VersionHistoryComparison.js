import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Button, ModalsController, CollapsableSection, HorizontalGroup, useStyles } from '@grafana/ui';
import { RevertDashboardModal } from './RevertDashboardModal';
import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';
import { jsonDiff } from './utils';
export var VersionHistoryComparison = function (_a) {
    var baseInfo = _a.baseInfo, newInfo = _a.newInfo, diffData = _a.diffData, isNewLatest = _a.isNewLatest;
    var diff = jsonDiff(diffData.lhs, diffData.rhs);
    var styles = useStyles(getStyles);
    return (React.createElement("div", null,
        React.createElement("div", { className: styles.spacer },
            React.createElement(HorizontalGroup, { justify: "space-between", align: "center" },
                React.createElement("div", null,
                    React.createElement("p", { className: styles.versionInfo },
                        React.createElement("strong", null,
                            "Version ",
                            newInfo.version),
                        " updated by ",
                        newInfo.createdBy,
                        " ",
                        newInfo.ageString,
                        " -",
                        ' ',
                        newInfo.message),
                    React.createElement("p", { className: cx(styles.versionInfo, styles.noMarginBottom) },
                        React.createElement("strong", null,
                            "Version ",
                            baseInfo.version),
                        " updated by ",
                        baseInfo.createdBy,
                        " ",
                        baseInfo.ageString,
                        " -",
                        ' ',
                        baseInfo.message)),
                isNewLatest && (React.createElement(ModalsController, null, function (_a) {
                    var showModal = _a.showModal, hideModal = _a.hideModal;
                    return (React.createElement(Button, { variant: "destructive", icon: "history", onClick: function () {
                            showModal(RevertDashboardModal, {
                                version: baseInfo.version,
                                hideModal: hideModal,
                            });
                        } },
                        "Restore to version ",
                        baseInfo.version));
                })))),
        React.createElement("div", { className: styles.spacer }, Object.entries(diff).map(function (_a) {
            var _b = __read(_a, 2), key = _b[0], diffs = _b[1];
            return (React.createElement(DiffGroup, { diffs: diffs, key: key, title: key }));
        })),
        React.createElement(CollapsableSection, { isOpen: false, label: "View JSON Diff" },
            React.createElement(DiffViewer, { oldValue: JSON.stringify(diffData.lhs, null, 2), newValue: JSON.stringify(diffData.rhs, null, 2) }))));
};
var getStyles = function (theme) { return ({
    spacer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.xl),
    versionInfo: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n  "], ["\n    color: ", ";\n    font-size: ", ";\n  "])), theme.colors.textWeak, theme.typography.size.sm),
    noMarginBottom: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=VersionHistoryComparison.js.map