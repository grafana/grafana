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
const SeriesTableRow: React.FC<SeriesTableRowProps> = ({ color, label, value, isActive }) => {
  const theme = useTheme();
  const styles = getSeriesTableStyles(theme);
  return (
    <div className={cx(styles.seriesTableRow, isActive && styles.activeSeries)}>
      <div className={styles.seriesTableCell}>
        {color && <SeriesIcon color={color} />} {label}
      </div>
      <div className={cx(styles.seriesTableCell, styles.value)}>{value}</div>
    </div>
  );
};

interface SeriesTableProps {
  timestamp?: string | GraphSeriesValue;
  series: SeriesTableRowProps[];
}

const getSeriesTableStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    seriesTable: css`
      display: table;
    `,
    seriesTableRow: css`
      display: table-row;
    `,
    seriesTableCell: css`
      display: table-cell;
    `,
    value: css`
      padding-left: ${theme.spacing.md};
    `,
    activeSeries: css`
      font-weight: ${theme.typography.weight.bold};
    `,
  };
});

export const SeriesTable: React.FC<SeriesTableProps> = ({ timestamp, series }) => {
  return (
    <>
      {timestamp && <div aria-label="Timestamp">{timestamp}</div>}
      {series.map(s => {
        return <SeriesTableRow isActive={s.isActive} label={s.label} color={s.color} value={s.value} key={s.label} />;
      })}
    </>
  );
};
