import React from 'react';
import { stylesFactory } from '../../../themes/stylesFactory';
import { GrafanaTheme, GraphSeriesValue } from '@grafana/data';
import { css, cx } from 'emotion';
import { SeriesIcon } from '../../Legend/SeriesIcon';
import { useTheme } from '../../../themes';

interface SeriesTableRowProps {
  color?: string;
  label?: string;
  value: string | GraphSeriesValue;
  isActive?: boolean;
}

const getSeriesTableRowStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      margin-right: ${theme.spacing.xs};
    `,
    seriesTable: css`
      display: table;
    `,
    seriesTableRow: css`
      display: table-row;
      font-size: ${theme.typography.size.sm};
    `,
    seriesTableCell: css`
      display: table-cell;
    `,
    label: css`
      word-break: break-all;
    `,
    value: css`
      padding-left: ${theme.spacing.md};
    `,
    activeSeries: css`
      font-weight: ${theme.typography.weight.bold};
    `,
    timestamp: css`
      font-weight: ${theme.typography.weight.bold};
      font-size: ${theme.typography.size.sm};
    `,
  };
});

const SeriesTableRow: React.FC<SeriesTableRowProps> = ({ color, label, value, isActive }) => {
  const theme = useTheme();
  const styles = getSeriesTableRowStyles(theme);
  return (
    <div className={cx(styles.seriesTableRow, isActive && styles.activeSeries)}>
      {color && (
        <div className={styles.seriesTableCell}>
          <SeriesIcon color={color} className={styles.icon} />
        </div>
      )}
      <div className={cx(styles.seriesTableCell, styles.label)}>{label}</div>
      <div className={cx(styles.seriesTableCell, styles.value)}>{value}</div>
    </div>
  );
};

interface SeriesTableProps {
  timestamp?: string | GraphSeriesValue;
  series: SeriesTableRowProps[];
}

export const SeriesTable: React.FC<SeriesTableProps> = ({ timestamp, series }) => {
  const theme = useTheme();
  const styles = getSeriesTableRowStyles(theme);

  return (
    <>
      {timestamp && (
        <div className={styles.timestamp} aria-label="Timestamp">
          {timestamp}
        </div>
      )}
      {series.map(s => {
        return <SeriesTableRow isActive={s.isActive} label={s.label} color={s.color} value={s.value} key={s.label} />;
      })}
    </>
  );
};
