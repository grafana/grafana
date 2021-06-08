import React, { useCallback } from 'react';
import { LegendProps, SeriesVisibilityChangeBehavior, VizLegendItem } from './types';
import { LegendDisplayMode } from './models.gen';
import { VizLegendTable } from './VizLegendTable';
import { VizLegendList } from './VizLegendList';
import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { SeriesVisibilityChangeMode, usePanelContext } from '../PanelChrome';
import { mapMouseEventToMode } from './utils';

/**
 * @public
 */
export function VizLegend<T>({
  items,
  displayMode,
  sortBy: sortKey,
  seriesVisibilityChangeBehavior = SeriesVisibilityChangeBehavior.Isolate,
  sortDesc,
  onLabelClick,
  onToggleSort,
  placement,
  className,
  itemRenderer,
  readonly,
}: LegendProps<T>) {
  const { eventBus, onToggleSeriesVisibility } = usePanelContext();

  const onMouseEnter = useCallback(
    (item: VizLegendItem, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      eventBus?.publish({
        type: DataHoverEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: item.label,
        },
      });
    },
    [eventBus]
  );

  const onMouseOut = useCallback(
    (item: VizLegendItem, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      eventBus?.publish({
        type: DataHoverClearEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: item.label,
        },
      });
    },
    [eventBus]
  );

  const onLegendLabelClick = useCallback(
    (item: VizLegendItem, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (onLabelClick) {
        onLabelClick(item, event);
      }
      if (onToggleSeriesVisibility) {
        onToggleSeriesVisibility(
          item.label,
          seriesVisibilityChangeBehavior === SeriesVisibilityChangeBehavior.Hide
            ? SeriesVisibilityChangeMode.AppendToSelection
            : mapMouseEventToMode(event)
        );
      }
    },
    [onToggleSeriesVisibility, onLabelClick, seriesVisibilityChangeBehavior]
  );

  switch (displayMode) {
    case LegendDisplayMode.Table:
      return (
        <VizLegendTable<T>
          className={className}
          items={items}
          placement={placement}
          sortBy={sortKey}
          sortDesc={sortDesc}
          onLabelClick={onLegendLabelClick}
          onToggleSort={onToggleSort}
          onLabelMouseEnter={onMouseEnter}
          onLabelMouseOut={onMouseOut}
          itemRenderer={itemRenderer}
          readonly={readonly}
        />
      );
    case LegendDisplayMode.List:
      return (
        <VizLegendList<T>
          className={className}
          items={items}
          placement={placement}
          onLabelMouseEnter={onMouseEnter}
          onLabelMouseOut={onMouseOut}
          onLabelClick={onLegendLabelClick}
          itemRenderer={itemRenderer}
          readonly={readonly}
        />
      );
    default:
      return null;
  }
}

VizLegend.displayName = 'Legend';
