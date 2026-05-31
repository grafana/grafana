import { css } from '@emotion/css';

import { type DisplayProcessor, formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { type BoxRow } from './fields';

interface Props {
  row: BoxRow;
  display?: DisplayProcessor;
}

export const BoxplotTooltip = ({ row, display }: Props) => {
  const styles = useStyles2(getStyles);
  const fmt = (v: number) => (display ? formattedValueToString(display(v)) : String(v));

  const items: Array<[string, number | undefined]> = [
    [t('boxplot.tooltip.max', 'Maximum'), row.values.max],
    [t('boxplot.tooltip.upper-whisker', 'Upper whisker'), row.values.upperWhisker],
    [t('boxplot.tooltip.q3', 'Upper quartile (Q3)'), row.values.q3],
    [t('boxplot.tooltip.median', 'Median'), row.values.median],
    [t('boxplot.tooltip.q1', 'Lower quartile (Q1)'), row.values.q1],
    [t('boxplot.tooltip.lower-whisker', 'Lower whisker'), row.values.lowerWhisker],
    [t('boxplot.tooltip.min', 'Minimum'), row.values.min],
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>{row.category}</div>
      <table className={styles.table}>
        <tbody>
          {items.map(([label, value]) =>
            value == null ? null : (
              <tr key={label}>
                <td className={styles.label}>{label}</td>
                <td className={styles.value}>{fmt(value)}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  header: css({
    fontWeight: theme.typography.fontWeightMedium,
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
  }),
  label: css({
    padding: theme.spacing(0.25, 1),
    color: theme.colors.text.secondary,
  }),
  value: css({
    padding: theme.spacing(0.25, 1),
    textAlign: 'right',
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
