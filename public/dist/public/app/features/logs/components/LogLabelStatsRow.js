import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
const getStyles = (theme) => ({
    logsStatsRow: css `
    label: logs-stats-row;
    margin: ${parseInt(theme.spacing(2), 10) / 1.75}px 0;
  `,
    logsStatsRowActive: css `
    label: logs-stats-row--active;
    color: ${theme.colors.primary.text};
    position: relative;
  `,
    logsStatsRowLabel: css `
    label: logs-stats-row__label;
    display: flex;
    margin-bottom: 1px;
  `,
    logsStatsRowValue: css `
    label: logs-stats-row__value;
    flex: 1;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
    logsStatsRowCount: css `
    label: logs-stats-row__count;
    text-align: right;
    margin-left: ${theme.spacing(0.75)};
  `,
    logsStatsRowPercent: css `
    label: logs-stats-row__percent;
    text-align: right;
    margin-left: ${theme.spacing(0.75)};
    width: ${theme.spacing(4.5)};
  `,
    logsStatsRowBar: css `
    label: logs-stats-row__bar;
    height: ${theme.spacing(0.5)};
    overflow: hidden;
    background: ${theme.colors.text.disabled};
  `,
    logsStatsRowInnerBar: css `
    label: logs-stats-row__innerbar;
    height: ${theme.spacing(0.5)};
    overflow: hidden;
    background: ${theme.colors.primary.main};
  `,
});
export const LogLabelStatsRow = ({ active, count, proportion, value }) => {
    const style = useStyles2(getStyles);
    const percent = `${Math.round(proportion * 100)}%`;
    const barStyle = { width: percent };
    const className = active ? cx([style.logsStatsRow, style.logsStatsRowActive]) : cx([style.logsStatsRow]);
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: cx([style.logsStatsRowLabel]) },
            React.createElement("div", { className: cx([style.logsStatsRowValue]), title: value }, value),
            React.createElement("div", { className: cx([style.logsStatsRowCount]) }, count),
            React.createElement("div", { className: cx([style.logsStatsRowPercent]) }, percent)),
        React.createElement("div", { className: cx([style.logsStatsRowBar]) },
            React.createElement("div", { className: cx([style.logsStatsRowInnerBar]), style: barStyle }))));
};
LogLabelStatsRow.displayName = 'LogLabelStatsRow';
//# sourceMappingURL=LogLabelStatsRow.js.map