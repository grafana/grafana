import React, { useCallback } from 'react';
import { LegendProps, VizLegendItem } from './types';
import { LegendDisplayMode } from './models.gen';
import { VizLegendTable } from './VizLegendTable';
import { VizLegendList } from './VizLegendList';
import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { usePanelContext } from '../PanelChrome';

/**
 * @public
 */
export function VizLegend<T>({
  items,
  displayMode,
  sortBy: sortKey,
  sortDesc,
  onToggleSort,
  onLabelClick,
  placement,
  className,
  itemRenderer,
}: LegendProps<T>) {
  const { eventBus } = usePanelContext();

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

  switch (displayMode) {
    case LegendDisplayMode.Table:
      return (
        <VizLegendTable<T>
          className={className}
          items={items}
          placement={placement}
          sortBy={sortKey}
          sortDesc={sortDesc}
          onLabelClick={onLabelClick as any}
          onToggleSort={onToggleSort}
          onLabelMouseEnter={onMouseEnter}
          onLabelMouseOut={onMouseOut}
          itemRenderer={itemRenderer}
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
          onLabelClick={onLabelClick}
          itemRenderer={itemRenderer}
        />
      );
    default:
      return null;
  }
}

VizLegend.displayName = 'Legend';
