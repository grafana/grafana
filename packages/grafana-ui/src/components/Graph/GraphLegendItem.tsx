import React, { PropsWithChildren, useContext } from 'react';
import { css, cx } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';
import { SeriesColorChangeHandler } from './GraphWithLegend';
import { LegendStatsList } from '../Legend/LegendStatsList';
import { ThemeContext } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes';
import { GrafanaTheme, formattedValueToString } from '@grafana/data';

export interface GraphLegendItemProps<T extends LegendItem> {
  key?: React.Key;
  item: T;
  className?: string;
  onLabelClick?: (item: T, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onToggleAxis?: () => void;
}

export function GraphLegendListItem<T extends LegendItem>({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
}: PropsWithChildren<GraphLegendItemProps<T>>) {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);
  return (
    <>
      <LegendSeriesIcon
        disabled={!onSeriesColorChange}
        color={item.color}
        onColorChange={color => {
          if (onSeriesColorChange) {
            onSeriesColorChange(item.label, color);
          }
        }}
        onToggleAxis={onToggleAxis}
        yAxis={item.yAxis}
      />
      <div
        onClick={event => {
          if (onLabelClick) {
            onLabelClick(item, event);
          }
        }}
        className={cx(styles.label, item.disabled && styles.labelDisabled)}
      >
        {item.label}
      </div>

      {item.displayValues && <LegendStatsList stats={item.displayValues} />}
    </>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    row: css`
      label: LegendRow;
      font-size: ${theme.typography.size.sm};
      td {
        padding: ${theme.spacing.xxs} ${theme.spacing.sm};
        white-space: nowrap;
      }
    `,
    label: css`
      label: LegendLabel;
      cursor: pointer;
      white-space: nowrap;
    `,
    labelDisabled: css`
      label: LegendLabelDisabled;
      color: ${theme.colors.linkDisabled};
    `,
    itemWrapper: css`
      display: flex;
      white-space: nowrap;
    `,
    value: css`
      text-align: right;
    `,
    yAxisLabel: css`
      color: ${theme.palette.gray2};
    `,
  };
});

export function GraphLegendTableRow<T extends LegendItem>({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
  className,
}: PropsWithChildren<GraphLegendItemProps<T>>) {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);
  return (
    <tr className={cx(styles.row, className)}>
      <td>
        <span className={styles.itemWrapper}>
          <LegendSeriesIcon
            disabled={!!onSeriesColorChange}
            color={item.color}
            onColorChange={color => {
              if (onSeriesColorChange) {
                onSeriesColorChange(item.label, color);
              }
            }}
            onToggleAxis={onToggleAxis}
            yAxis={item.yAxis}
          />
          <div
            onClick={event => {
              if (onLabelClick) {
                onLabelClick(item, event);
              }
            }}
            className={styles.label}
          >
            {item.label} {item.yAxis === 2 && <span className={styles.yAxisLabel}>(right y-axis)</span>}
          </div>
        </span>
      </td>
      {item.displayValues &&
        item.displayValues.map((stat, index) => {
          return (
            <td className={styles.value} key={`${stat.title}-${index}`}>
              {formattedValueToString(stat)}
            </td>
          );
        })}
    </tr>
  );
}
