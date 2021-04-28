import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem, SeriesColorChangeHandler } from './types';
import { VizLegendStatsList } from './VizLegendStatsList';
import { useStyles } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

export interface Props {
  item: VizLegendItem;
  className?: string;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onLabelMouseEnter?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onLabelMouseOut?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * @internal
 */
export const VizLegendListItem: React.FunctionComponent<Props> = ({
  item,
  onSeriesColorChange,
  onLabelClick,
  onLabelMouseEnter,
  onLabelMouseOut,
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

  const onColorChange = useCallback(
    (color: string) => {
      if (onSeriesColorChange) {
        onSeriesColorChange(item.label, color);
      }
    },
    [item, onSeriesColorChange]
  );

  return (
    <div className={styles.itemWrapper}>
      <VizLegendSeriesIcon disabled={!onSeriesColorChange} color={item.color} onColorChange={onColorChange} />
      <div
        onMouseEnter={onMouseEnter}
        onMouseOut={onMouseOut}
        onClick={onClick}
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
