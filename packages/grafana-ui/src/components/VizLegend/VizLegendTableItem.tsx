import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem } from './types';
import { useStyles } from '../../themes/ThemeContext';
import { styleMixins } from '../../themes';
import { GrafanaTheme, formattedValueToString } from '@grafana/data';

export interface Props {
  key?: React.Key;
  item: VizLegendItem;
  className?: string;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onLabelMouseEnter?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onLabelMouseOut?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  readonly?: boolean;
}

/**
 * @internal
 */
export const LegendTableItem: React.FunctionComponent<Props> = ({
  item,
  onLabelClick,
  onLabelMouseEnter,
  onLabelMouseOut,
  className,
  readonly,
}) => {
  const styles = useStyles(getStyles);

  const onMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (onLabelMouseEnter) {
        onLabelMouseEnter(item, event);
      }
    },
    [item, onLabelMouseEnter]
  );

  const onMouseOut = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (onLabelMouseOut) {
        onLabelMouseOut(item, event);
      }
    },
    [item, onLabelMouseOut]
  );

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (onLabelClick) {
        onLabelClick(item, event);
      }
    },
    [item, onLabelClick]
  );

  return (
    <tr className={cx(styles.row, className)}>
      <td>
        <span className={styles.itemWrapper}>
          <VizLegendSeriesIcon color={item.color} seriesName={item.label} readonly={readonly} />
          <div
            onMouseEnter={onMouseEnter}
            onMouseOut={onMouseOut}
            onClick={!readonly ? onClick : undefined}
            className={cx(styles.label, item.disabled && styles.labelDisabled, !readonly && styles.clickable)}
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
      white-space: nowrap;
    `,
    labelDisabled: css`
      label: LegendLabelDisabled;
      color: ${theme.colors.linkDisabled};
    `,
    clickable: css`
      label: LegendClickable;
      cursor: pointer;
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
