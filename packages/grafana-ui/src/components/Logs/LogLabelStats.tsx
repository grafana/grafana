import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { LogLabelStatsModel, GrafanaTheme } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { stylesFactory } from '../../themes';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { withTheme } from '../../themes/index';

//Components
import { LogLabelStatsRow } from './LogLabelStatsRow';

const STATS_ROW_LIMIT = 5;

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.dark9,
    },
    theme.type
  );
  return {
    logsStats: css`
      label: logs-stats;
      column-span: 2;
      background: inherit;
      color: ${theme.colors.text};
      word-break: break-all;
    `,
    logsStatsHeader: css`
      label: logs-stats__header;
      border-bottom: 1px solid ${borderColor};
      display: flex;
    `,
    logsStatsTitle: css`
      label: logs-stats__title;
      font-weight: ${theme.typography.weight.semibold};
      padding-right: ${theme.spacing.d};
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
      padding: 5px 0;
    `,
  };
});

interface Props extends Themeable {
  stats: LogLabelStatsModel[];
  label: string;
  value: string;
  rowCount: number;
  isLabel?: boolean;
}

class UnThemedLogLabelStats extends PureComponent<Props> {
  render() {
    const { label, rowCount, stats, value, theme, isLabel } = this.props;
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
      <td className={style.logsStats}>
        <div className={style.logsStatsHeader}>
          <div className={style.logsStatsTitle}>
            {label}: {total} of {rowCount} rows have that {isLabel ? 'label' : 'field'}
          </div>
        </div>
        <div className={style.logsStatsBody}>
          {topRows.map(stat => (
            <LogLabelStatsRow key={stat.value} {...stat} active={stat.value === value} />
          ))}
          {insertActiveRow && activeRow && <LogLabelStatsRow key={activeRow.value} {...activeRow} active />}
          {otherCount > 0 && (
            <LogLabelStatsRow key="__OTHERS__" count={otherCount} value="Other" proportion={otherProportion} />
          )}
        </div>
      </td>
    );
  }
}

export const LogLabelStats = withTheme(UnThemedLogLabelStats);
LogLabelStats.displayName = 'LogLabelStats';
