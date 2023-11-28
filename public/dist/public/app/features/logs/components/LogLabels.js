import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
// Levels are already encoded in color, filename is a Loki-ism
const HIDDEN_LABELS = ['level', 'lvl', 'filename'];
export const LogLabels = ({ labels }) => {
    const styles = useStyles2(getStyles);
    const displayLabels = Object.keys(labels).filter((label) => !label.startsWith('_') && !HIDDEN_LABELS.includes(label));
    if (displayLabels.length === 0) {
        return (React.createElement("span", { className: cx([styles.logsLabels]) },
            React.createElement("span", { className: cx([styles.logsLabel]) }, "(no unique labels)")));
    }
    return (React.createElement("span", { className: cx([styles.logsLabels]) }, displayLabels.sort().map((label) => {
        const value = labels[label];
        if (!value) {
            return;
        }
        const tooltip = `${label}: ${value}`;
        return (React.createElement("span", { key: label, className: cx([styles.logsLabel]) },
            React.createElement("span", { className: cx([styles.logsLabelValue]), title: tooltip }, value)));
    })));
};
const getStyles = (theme) => {
    return {
        logsLabels: css `
      display: flex;
      flex-wrap: wrap;
      font-size: ${theme.typography.size.xs};
    `,
        logsLabel: css `
      label: logs-label;
      display: flex;
      padding: ${theme.spacing(0, 0.25)};
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      margin: ${theme.spacing(0.125, 0.5, 0, 0)};
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    `,
        logsLabelValue: css `
      label: logs-label__value;
      display: inline-block;
      max-width: ${theme.spacing(25)};
      text-overflow: ellipsis;
      overflow: hidden;
    `,
    };
};
//# sourceMappingURL=LogLabels.js.map