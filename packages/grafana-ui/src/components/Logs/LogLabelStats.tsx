import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { LogLabelStatsModel } from '@grafana/data';

import { LogLabelStatsRow } from './LogLabelStatsRow';
import { Themeable, GrafanaTheme } from '../../types/theme';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { withTheme } from '../../themes/index';

const STATS_ROW_LIMIT = 5;

const getStyles = (theme: GrafanaTheme) => ({
  logsStats: css`
    label: logs-stats;
    background-color: ${selectThemeVariant({ light: theme.colors.pageBg, dark: theme.colors.dark2 }, theme.type)};
    color: ${theme.colors.text};
    border: 1px solid ${selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark9 }, theme.type)};
    border-radius: ${theme.border.radius.md};
    max-width: 500px;
  `,
  logsStatsHeader: css`
    label: logs-stats__header;
    background: ${selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark9 }, theme.type)};
    padding: 6px 10px;
    display: flex;
  `,
  logsStatsTitle: css`
    label: logs-stats__title;
    font-weight: ${theme.typography.weight.semibold};
    padding-right: ${theme.spacing.d};
    overflow: hidden;
    display: inline-block;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex-grow: 1;
  `,
  logsStatsClose: css`
    label: logs-stats__close;
    cursor: pointer;
  `,
  logsStatsBody: css`
    label: logs-stats__body;
    padding: 20px 10px 10px 10px;
  `,
});

interface Props extends Themeable {
  stats: LogLabelStatsModel[];
  label: string;
  value: string;
  rowCount: number;
  onClickClose: () => void;
}

class UnThemedLogLabelStats extends PureComponent<Props> {
  render() {
    const { label, rowCount, stats, value, onClickClose, theme } = this.props;
    const style = getStyles(theme);
    const topRows = stats.slice(0, STATS_ROW_LIMIT);
    let activeRow = topRows.find(row => row.value === value);
    let otherRows = stats.slice(STATS_ROW_LIMIT);
    const insertActiveRow = !activeRow;

    // Remove active row from other to show extra
    if (insertActiveRow) {
      activeRow = otherRows.find(row => row.value === value);
      otherRows = otherRows.filter(row => row.value !== value);
    }

    const otherCount = otherRows.reduce((sum, row) => sum + row.count, 0);
    const topCount = topRows.reduce((sum, row) => sum + row.count, 0);
    const total = topCount + otherCount;
    const otherProportion = otherCount / total;

    return (
      <div className={cx([style.logsStats])}>
        <div className={cx([style.logsStatsHeader])}>
          <span className={cx([style.logsStatsTitle])}>
            {label}: {total} of {rowCount} rows have that label
          </span>
          <span className={cx([style.logsStatsClose, 'fa fa-remove'])} onClick={onClickClose} />
        </div>
        <div className={cx([style.logsStatsBody])}>
          {topRows.map(stat => (
            <LogLabelStatsRow key={stat.value} {...stat} active={stat.value === value} />
          ))}
          {insertActiveRow && activeRow && <LogLabelStatsRow key={activeRow.value} {...activeRow} active />}
          {otherCount > 0 && (
            <LogLabelStatsRow key="__OTHERS__" count={otherCount} value="Other" proportion={otherProportion} />
          )}
        </div>
      </div>
    );
  }
}

export const LogLabelStats = withTheme(UnThemedLogLabelStats);
LogLabelStats.displayName = 'LogLabelStats';
