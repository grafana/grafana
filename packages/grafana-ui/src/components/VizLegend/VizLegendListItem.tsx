import React, { useCallback, useContext } from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';
import { VizLegendItem, SeriesColorChangeHandler } from './types';
import { VizLegendStatsList } from './VizLegendStatsList';
import { useStyles } from '../../themes';
import { DataHoverClearEvent, DataHoverEvent, EventBusWithSourceContext, GrafanaTheme } from '@grafana/data';

export interface Props {
  item: VizLegendItem;
  className?: string;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
}

/**
 * @internal
 */
export const VizLegendListItem: React.FunctionComponent<Props> = ({ item, onSeriesColorChange, onLabelClick }) => {
  const styles = useStyles(getStyles);
  const eventBus = useContext(EventBusWithSourceContext);

  const onMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (eventBus) {
        eventBus.publish({
          type: DataHoverEvent.type,
          payload: {
            raw: event,
            x: 0,
            y: 0,
            dataId: item.label,
          },
        });
      }
    },
    [eventBus, item]
  );

  const onMouseOut = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (eventBus) {
        eventBus.publish({
          type: DataHoverClearEvent.type,
          payload: {
            raw: event,
            x: 0,
            y: 0,
            dataId: item.label,
          },
        });
      }
    },
    [eventBus, item]
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
