import { css, cx } from '@emotion/css';
import React from 'react';
import { Button, ModalsController, CollapsableSection, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { DiffGroup } from './DiffGroup';
import { DiffViewer } from './DiffViewer';
import { RevertDashboardModal } from './RevertDashboardModal';
import { jsonDiff } from './utils';
export const VersionHistoryComparison = ({ baseInfo, newInfo, diffData, isNewLatest }) => {
    const diff = jsonDiff(diffData.lhs, diffData.rhs);
    const styles = useStyles2(getStyles);
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
                isNewLatest && (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { variant: "destructive", icon: "history", onClick: () => {
                        showModal(RevertDashboardModal, {
                            version: baseInfo.version,
                            hideModal,
                        });
                    } },
                    "Restore to version ",
                    baseInfo.version)))))),
        React.createElement("div", { className: styles.spacer }, Object.entries(diff).map(([key, diffs]) => (React.createElement(DiffGroup, { diffs: diffs, key: key, title: key })))),
        React.createElement(CollapsableSection, { isOpen: false, label: "View JSON Diff" },
            React.createElement(DiffViewer, { oldValue: JSON.stringify(diffData.lhs, null, 2), newValue: JSON.stringify(diffData.rhs, null, 2) }))));
};
const getStyles = (theme) => ({
    spacer: css `
    margin-bottom: ${theme.spacing(4)};
  `,
    versionInfo: css `
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
    noMarginBottom: css `
    margin-bottom: 0;
  `,
});
//# sourceMappingURL=VersionHistoryComparison.js.map