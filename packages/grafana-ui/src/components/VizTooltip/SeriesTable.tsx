import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, GraphSeriesValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { SeriesIcon } from '../VizLegend/SeriesIcon';

/**
 * @public
 */
export interface SeriesTableRowProps {
  color?: string;
  label?: React.ReactNode;
  value?: string | GraphSeriesValue;
  isActive?: boolean;
}

const getSeriesTableRowStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      marginRight: theme.spacing(1),
      verticalAlign: 'middle',
    }),
    seriesTable: css({
      display: 'table',
    }),
    seriesTableRow: css({
      display: 'table-row',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    seriesTableCell: css({
      display: 'table-cell',
    }),
    label: css({
      wordBreak: 'break-all',
    }),
    value: css({
      paddingLeft: theme.spacing(2),
      textAlign: 'right',
    }),
    activeSeries: css({
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.maxContrast,
    }),
    timestamp: css({
      fontWeight: theme.typography.fontWeightBold,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};

/**
 * @public
 */
export const SeriesTableRow = ({ color, label, value, isActive }: SeriesTableRowProps) => {
  const styles = useStyles2(getSeriesTableRowStyles);

  return (
    <div data-testid="SeriesTableRow" className={cx(styles.seriesTableRow, isActive && styles.activeSeries)}>
      {color && (
        <div className={styles.seriesTableCell}>
          <SeriesIcon color={color} className={styles.icon} />
        </div>
      )}
      {label && <div className={cx(styles.seriesTableCell, styles.label)}>{label}</div>}
      {value && <div className={cx(styles.seriesTableCell, styles.value)}>{value}</div>}
    </div>
  );
};

/**
 * @public
 */
export interface SeriesTableProps {
  timestamp?: string | GraphSeriesValue;
  series: SeriesTableRowProps[];
}

/**
 * @public
 */
export const SeriesTable = ({ timestamp, series }: SeriesTableProps) => {
  const styles = useStyles2(getSeriesTableRowStyles);

  return (
    <>
      {timestamp && (
        <div className={styles.timestamp} aria-label={t('grafana-ui.viz-tooltip.timestamp', 'Timestamp')}>
          {timestamp}
        </div>
      )}
      {series.map((s, i) => {
        return (
          <SeriesTableRow
            isActive={s.isActive}
            label={s.label}
            color={s.color}
            value={s.value}
            key={`${s.label}-${i}`}
          />
        );
      })}
    </>
  );
};
