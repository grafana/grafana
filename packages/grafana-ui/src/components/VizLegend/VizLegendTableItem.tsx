import React from 'react';
import { css, cx } from 'emotion';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem } from './types';
import { SeriesColorChangeHandler } from './types';
import { useStyles } from '../../themes/ThemeContext';
import { styleMixins } from '../../themes';
import { GrafanaTheme, formattedValueToString } from '@grafana/data';

export interface Props {
  key?: React.Key;
  item: VizLegendItem;
  className?: string;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
}

export const LegendTableItem: React.FunctionComponent<Props> = ({
  item,
  onSeriesColorChange,
  onLabelClick,
  className,
}) => {
  const styles = useStyles(getStyles);

  return (
    <tr className={cx(styles.row, className)}>
      <td>
        <span className={styles.itemWrapper}>
          <VizLegendSeriesIcon
            disabled={!onSeriesColorChange}
            color={item.color}
            onColorChange={(color) => {
              if (onSeriesColorChange) {
                onSeriesColorChange(item.label, color);
              }
            }}
          />
          <div
            onClick={(event) => {
              if (onLabelClick) {
                onLabelClick(item, event);
              }
            }}
            className={cx(styles.label, item.disabled && styles.labelDisabled)}
          >
            {item.label} {item.yAxis === 2 && <span className={styles.yAxisLabel}>(right y-axis)</span>}
          </div>
        </span>
      </td>
      {item.getDisplayValues &&
        item.getDisplayValues().map((stat, index) => {
          return (
            <td className={styles.value} key={`${stat.title}-${index}`}>
              {formattedValueToString(stat)}
            </td>
          );
        })}
    </tr>
  );
};

LegendTableItem.displayName = 'LegendTableItem';

const getStyles = (theme: GrafanaTheme) => {
  const rowHoverBg = styleMixins.hoverColor(theme.colors.bg1, theme);

  return {
    row: css`
      label: LegendRow;
      font-size: ${theme.typography.size.sm};
      border-bottom: 1px solid ${theme.colors.border1};
      td {
        padding: ${theme.spacing.xxs} ${theme.spacing.sm};
        white-space: nowrap;
      }

      &:hover {
        background: ${rowHoverBg};
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
      align-items: center;
    `,
    value: css`
      text-align: right;
    `,
    yAxisLabel: css`
      color: ${theme.palette.gray2};
    `,
  };
};
