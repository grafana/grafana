import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, GraphSeriesValue } from '@grafana/data';

import { useStyles2 } from '../../themes';
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
    icon: css`
      margin-right: ${theme.spacing(1)};
      vertical-align: middle;
    `,
    seriesTable: css`
      display: table;
    `,
    seriesTableRow: css`
      display: table-row;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    seriesTableCell: css`
      display: table-cell;
    `,
    label: css`
      word-break: break-all;
    `,
    value: css`
      padding-left: ${theme.spacing(2)};
    `,
    activeSeries: css`
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.text.maxContrast};
    `,
    timestamp: css`
      font-weight: ${theme.typography.fontWeightBold};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
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
        <div className={styles.timestamp} aria-label="Timestamp">
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
