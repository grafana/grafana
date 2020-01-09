import React, { FunctionComponent, useContext } from 'react';
import { css, cx } from 'emotion';

import { ThemeContext } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';

const getStyles = (theme: GrafanaTheme) => ({
  logsStatsRow: css`
    label: logs-stats-row;
    margin: ${parseInt(theme.spacing.d, 10) / 1.75}px 0;
  `,
  logsStatsRowActive: css`
    label: logs-stats-row--active;
    color: ${theme.colors.blue};
    position: relative;
  `,
  logsStatsRowLabel: css`
    label: logs-stats-row__label;
    display: flex;
    margin-bottom: 1px;
  `,
  logsStatsRowValue: css`
    label: logs-stats-row__value;
    flex: 1;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
  logsStatsRowCount: css`
    label: logs-stats-row__count;
    text-align: right;
    margin-left: 0.5em;
  `,
  logsStatsRowPercent: css`
    label: logs-stats-row__percent;
    text-align: right;
    margin-left: 0.5em;
    width: 3em;
  `,
  logsStatsRowBar: css`
    label: logs-stats-row__bar;
    height: 4px;
    overflow: hidden;
    background: ${theme.colors.textFaint};
  `,
  logsStatsRowInnerBar: css`
    label: logs-stats-row__innerbar;
    height: 4px;
    overflow: hidden;
    background: ${theme.colors.textFaint};
    background: ${theme.colors.blue};
  `,
});

export interface Props {
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
}

export const LogLabelStatsRow: FunctionComponent<Props> = ({ active, count, proportion, value }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };
  const className = active ? cx([style.logsStatsRow, style.logsStatsRowActive]) : cx([style.logsStatsRow]);

  return (
    <div className={className}>
      <div className={cx([style.logsStatsRowLabel])}>
        <div className={cx([style.logsStatsRowValue])} title={value}>
          {value}
        </div>
        <div className={cx([style.logsStatsRowCount])}>{count}</div>
        <div className={cx([style.logsStatsRowPercent])}>{percent}</div>
      </div>
      <div className={cx([style.logsStatsRowBar])}>
        <div className={cx([style.logsStatsRowInnerBar])} style={barStyle} />
      </div>
    </div>
  );
};

LogLabelStatsRow.displayName = 'LogLabelStatsRow';
