import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import { Spinner, useStyles2 } from '@grafana/ui';
import { DiffGroup } from '../VersionHistory/DiffGroup';
import { DiffViewer } from '../VersionHistory/DiffViewer';
export const SaveDashboardDiff = ({ diff, oldValue, newValue }) => {
    const styles = useStyles2(getStyles);
    const loader = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const oldJSON = JSON.stringify(oldValue !== null && oldValue !== void 0 ? oldValue : {}, null, 2);
        const newJSON = JSON.stringify(newValue !== null && newValue !== void 0 ? newValue : {}, null, 2);
        // Schema changes will have MANY changes that the user will not understand
        let schemaChange = undefined;
        const diffs = [];
        let count = 0;
        if (diff) {
            for (const [key, changes] of Object.entries(diff)) {
                // this takes a long time for large diffs (so this is async)
                const g = React.createElement(DiffGroup, { diffs: changes, key: key, title: key });
                if (key === 'schemaVersion') {
                    schemaChange = g;
                }
                else {
                    diffs.push(g);
                }
                count += changes.length;
            }
        }
        return {
            schemaChange,
            diffs,
            count,
            showDiffs: count < 15,
            jsonView: React.createElement(DiffViewer, { oldValue: oldJSON, newValue: newJSON }),
        };
    }), [diff, oldValue, newValue]);
    const { value } = loader;
    if (!value || !oldValue) {
        return React.createElement(Spinner, null);
    }
    if (value.count < 1) {
        return React.createElement("div", null, "No changes in this dashboard");
    }
    return (React.createElement("div", null,
        value.schemaChange && React.createElement("div", { className: styles.spacer }, value.schemaChange),
        value.showDiffs && React.createElement("div", { className: styles.spacer }, value.diffs),
        React.createElement("h4", null, "JSON Model"),
        value.jsonView));
};
const getStyles = (theme) => ({
    spacer: css `
    margin-bottom: ${theme.v1.spacing.xl};
  `,
});
//# sourceMappingURL=SaveDashboardDiff.js.map