import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  logsStatsRow: css({
    label: 'logs-stats-row',
    margin: `${parseInt(theme.spacing(2), 10) / 1.75}px 0`,
  }),
  logsStatsRowActive: css({
    label: 'logs-stats-row--active',
    color: theme.colors.primary.text,
    position: 'relative',
  }),
  logsStatsRowLabel: css({
    label: 'logs-stats-row__label',
    display: 'flex',
    marginBottom: '1px',
  }),
  logsStatsRowValue: css({
    label: 'logs-stats-row__value',
    flex: 1,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  logsStatsRowCount: css({
    label: 'logs-stats-row__count',
    textAlign: 'right',
    marginLeft: theme.spacing(0.75),
  }),
  logsStatsRowPercent: css({
    label: 'logs-stats-row__percent',
    textAlign: 'right',
    marginLeft: theme.spacing(0.75),
    width: theme.spacing(4.5),
  }),
  logsStatsRowBar: css({
    label: 'logs-stats-row__bar',
    height: theme.spacing(0.5),
    overflow: 'hidden',
    background: theme.colors.text.disabled,
  }),
  logsStatsRowInnerBar: css({
    label: 'logs-stats-row__innerbar',
    height: theme.spacing(0.5),
    overflow: 'hidden',
    background: theme.colors.primary.main,
  }),
});

export interface Props {
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
}

export const LogLabelStatsRow = ({ active, count, proportion, value }: Props) => {
  const style = useStyles2(getStyles);
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
