import { css } from '@emotion/css';
import { useMemo } from 'react';

import { LogLabelStatsModel, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { LogLabelStatsRow } from './LogLabelStatsRow';

const STATS_ROW_LIMIT = 5;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logsStats: css({
      label: 'logs-stats',
      background: 'inherit',
      color: theme.colors.text.primary,
      wordBreak: 'break-all',
      width: 'fit-content',
      maxWidth: '100%',
    }),
    logsStatsHeader: css({
      label: 'logs-stats__header',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      display: 'flex',
    }),
    logsStatsTitle: css({
      label: 'logs-stats__title',
      fontWeight: theme.typography.fontWeightMedium,
      paddingRight: theme.spacing(2),
      display: 'inline-block',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      flexGrow: 1,
    }),
    logsStatsClose: css({
      label: 'logs-stats__close',
      cursor: 'pointer',
    }),
    logsStatsBody: css({
      label: 'logs-stats__body',
      padding: '5px 0px',
    }),
  };
};

interface Props {
  className?: string;
  stats: LogLabelStatsModel[];
  label: string;
  value: string;
  rowCount: number;
  isLabel?: boolean;
}

export const LogLabelStats = ({ className, label, rowCount, stats, value, isLabel }: Props) => {
  const style = useStyles2(getStyles);
  const rows = useMemo(() => {
    const topRows = stats.slice(0, STATS_ROW_LIMIT);
    let activeRow = topRows.find((row) => row.value === value);
    let otherRows = stats.slice(STATS_ROW_LIMIT);
    const insertActiveRow = !activeRow;

    // Remove active row from other to show extra
    if (insertActiveRow) {
      activeRow = otherRows.find((row) => row.value === value);
      otherRows = otherRows.filter((row) => row.value !== value);
    }
    return { topRows, otherRows, insertActiveRow, activeRow };
  }, [stats, value]);

  const otherCount = useMemo(() => rows.otherRows.reduce((sum, row) => sum + row.count, 0), [rows.otherRows]);
  const topCount = useMemo(() => rows.topRows.reduce((sum, row) => sum + row.count, 0), [rows.topRows]);
  const total = topCount + otherCount;
  const otherProportion = otherCount / total;

  return (
    <div className={className ?? style.logsStats} data-testid="logLabelStats">
      <div className={style.logsStatsHeader}>
        <div className={style.logsStatsTitle}>
          {isLabel
            ? t(
                'logs.un-themed-log-label-stats.label-log-stats',
                '{{label}}: {{total}} of {{rowCount}} rows have that label',
                {
                  label,
                  total,
                  rowCount,
                }
              )
            : t(
                'logs.un-themed-log-label-stats.field-log-stats',
                '{{label}}: {{total}} of {{rowCount}} rows have that field'
              )}
        </div>
      </div>
      <div className={style.logsStatsBody}>
        {rows.topRows.map((stat) => (
          <LogLabelStatsRow key={stat.value} {...stat} active={stat.value === value} />
        ))}
        {rows.insertActiveRow && rows.activeRow && (
          <LogLabelStatsRow key={rows.activeRow.value} {...rows.activeRow} active />
        )}
        {otherCount > 0 && (
          <LogLabelStatsRow key="__OTHERS__" count={otherCount} value="Other" proportion={otherProportion} />
        )}
      </div>
    </div>
  );
};
