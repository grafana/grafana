import { css, cx } from '@emotion/css';
import React from 'react';
import { Spinner, TimeRangeLabel, useStyles2 } from '@grafana/ui';
export function SettingsSummary({ className, isDataLoading = false, timeRange, timeSelectionEnabled, annotationsEnabled, }) {
    const styles = useStyles2(getStyles);
    return isDataLoading ? (React.createElement("div", { className: cx(styles.summaryWrapper, className) },
        React.createElement(Spinner, { className: styles.summary, inline: true, size: 14 }))) : (React.createElement("div", { className: cx(styles.summaryWrapper, className) },
        React.createElement("span", { className: styles.summary },
            'Time range = ',
            React.createElement(TimeRangeLabel, { className: styles.timeRange, value: timeRange })),
        React.createElement("span", { className: styles.summary }, `Time range picker = ${timeSelectionEnabled ? 'enabled' : 'disabled'}`),
        React.createElement("span", { className: styles.summary }, `Annotations = ${annotationsEnabled ? 'show' : 'hide'}`)));
}
SettingsSummary.displayName = 'SettingsSummary';
const getStyles = (theme) => {
    return {
        summaryWrapper: css({
            display: 'flex',
        }),
        summary: css `
      label: collapsedText;
      margin-left: ${theme.spacing.gridSize * 2}px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
        timeRange: css({
            display: 'inline-block',
        }),
    };
};
//# sourceMappingURL=SettingsSummary.js.map