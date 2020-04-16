import React, { useContext } from 'react';
import { css, cx } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';
import { SeriesColorChangeHandler } from './GraphWithLegend';
import { LegendStatsList } from '../Legend/LegendStatsList';
import { ThemeContext } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes';
import { GrafanaTheme, formattedValueToString } from '@grafana/data';

export interface GraphLegendItemProps {
  key?: React.Key;
  item: LegendItem;
  className?: string;
  onLabelClick?: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onToggleAxis?: () => void;
}

export const GraphLegendListItem: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
}) => {
  const theme = useContext(ThemeContext);

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
        className={css`
          cursor: pointer;
          white-space: pre-wrap;
          color: ${!item.isVisible && theme.colors.linkDisabled};
        `}
      >
        {item.label}
      </div>

      {item.displayValues && <LegendStatsList stats={item.displayValues} />}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    row: css`
      font-size: ${theme.typography.size.sm};
      td {
        padding: ${theme.spacing.xxs} ${theme.spacing.sm};
        white-space: nowrap;
      }
    `,
    label: css`
      cursor: pointer;
      white-space: nowrap;
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

export const GraphLegendTableRow: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
  className,
}) => {
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
};
