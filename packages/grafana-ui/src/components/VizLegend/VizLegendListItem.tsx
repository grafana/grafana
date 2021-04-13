import React from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem, SeriesColorChangeHandler } from './types';
import { VizLegendStatsList } from './VizLegendStatsList';
import { useStyles } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

export interface Props<T> {
  item: VizLegendItem<T>;
  className?: string;
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
}

/**
 * @internal
 */
export const VizLegendListItem = <T extends unknown = any>({
  item,
  onSeriesColorChange,
  onLabelClick,
  className,
}: Props<T>) => {
  const styles = useStyles(getStyles);

  return (
    <div className={cx(styles.itemWrapper, className)}>
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
        {item.label}
      </div>

      {item.getDisplayValues && <VizLegendStatsList stats={item.getDisplayValues()} />}
    </div>
  );
};

VizLegendListItem.displayName = 'VizLegendListItem';

const getStyles = (theme: GrafanaTheme) => ({
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
    label: LegendItemWrapper;
    display: flex;
    white-space: nowrap;
    align-items: center;
    flex-grow: 1;
  `,
  value: css`
    text-align: right;
  `,
  yAxisLabel: css`
    color: ${theme.palette.gray2};
  `,
});
