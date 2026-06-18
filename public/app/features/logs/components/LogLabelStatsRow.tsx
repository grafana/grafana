import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, type IconSize, useStyles2 } from '@grafana/ui';

import { AsyncIconButton } from './panel/AsyncIconButton';

const getStyles = (theme: GrafanaTheme2) => ({
  logsStatsRow: css({
    label: 'logs-stats-row',
    margin: `${parseInt(theme.spacing(2), 10) / 1.75}px 0`,
    position: 'relative',
  }),
  logsStatsRowActive: css({
    label: 'logs-stats-row--active',
    color: theme.colors.primary.text,
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
  logStatsActions: css({
    position: 'absolute',
    display: 'inline-block',
    left: theme.spacing(-5.5),
    top: theme.spacing(0.75),
  }),
});

export interface Props {
  isValueActive?(): Promise<boolean>;
  include?(value: string): void;
  exclude?(value: string): void;
  iconSize?: IconSize;
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
}

export const LogLabelStatsRow = ({
  active,
  count,
  proportion,
  value,
  iconSize,
  include,
  exclude,
  isValueActive,
}: Props) => {
  const style = useStyles2(getStyles);
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };
  const className = active ? cx([style.logsStatsRow, style.logsStatsRowActive]) : cx([style.logsStatsRow]);

  return (
    <div className={className}>
      {(include || exclude) && value && (
        <div className={style.logStatsActions}>
          {include && (
            <AsyncIconButton
              name="search-plus"
              onClick={() => include(value)}
              isActive={isValueActive}
              size={iconSize}
              tooltipSuffix=""
            />
          )}
          {exclude && (
            <IconButton
              name="search-minus"
              size={iconSize}
              tooltip={t('logs.log-line-details.fields.filter-out', 'Filter out value')}
              onClick={() => exclude(value)}
            />
          )}
        </div>
      )}
      <div className={style.logsStatsRowLabel}>
        <div className={style.logsStatsRowValue} title={value}>
          {value}
        </div>
        <div className={style.logsStatsRowCount}>{count}</div>
        <div className={style.logsStatsRowPercent}>{percent}</div>
      </div>
      <div className={style.logsStatsRowBar}>
        <div className={style.logsStatsRowInnerBar} style={barStyle} />
      </div>
    </div>
  );
};

LogLabelStatsRow.displayName = 'LogLabelStatsRow';
