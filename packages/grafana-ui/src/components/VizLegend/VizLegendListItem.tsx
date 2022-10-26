import { css, cx } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles } from '../../themes';

import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendStatsList } from './VizLegendStatsList';
import { VizLegendItem } from './types';

export interface Props<T> {
  item: VizLegendItem<T>;
  className?: string;
  onLabelClick?: (item: VizLegendItem<T>, event: React.MouseEvent<HTMLDivElement>) => void;
  onLabelMouseEnter?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onLabelMouseOut?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  readonly?: boolean;
}

/**
 * @internal
 */
export const VizLegendListItem = <T = unknown,>({
  item,
  onLabelClick,
  onLabelMouseEnter,
  onLabelMouseOut,
  className,
  readonly,
}: Props<T>) => {
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
    <div
      className={cx(styles.itemWrapper, item.disabled && styles.itemDisabled, className)}
      aria-label={selectors.components.VizLegend.seriesName(item.label)}
    >
      <VizLegendSeriesIcon seriesName={item.label} color={item.color} gradient={item.gradient} readonly={readonly} />
      <div
        onMouseEnter={onMouseEnter}
        onMouseOut={onMouseOut}
        onClick={!readonly ? onClick : undefined}
        className={cx(styles.label, !readonly && styles.clickable)}
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
    white-space: nowrap;
  `,
  clickable: css`
    label: LegendClickabel;
    cursor: pointer;
  `,
  itemDisabled: css`
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
