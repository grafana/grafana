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
export const VizLegend: React.FunctionComponent<LegendProps> = ({
  items,
  displayMode,
  sortBy: sortKey,
  sortDesc,
  onToggleSort,
  onLabelClick,
  onSeriesColorChange,
  placement,
  className,
}) => {
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
        <VizLegendTable
          className={className}
          items={items}
          placement={placement}
          sortBy={sortKey}
          sortDesc={sortDesc}
          onLabelClick={onLabelClick}
          onToggleSort={onToggleSort}
          onLabelMouseEnter={onMouseEnter}
          onLabelMouseOut={onMouseOut}
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    case LegendDisplayMode.List:
      return (
        <VizLegendList
          className={className}
          items={items}
          placement={placement}
          onLabelMouseEnter={onMouseEnter}
          onLabelMouseOut={onMouseOut}
          onLabelClick={onLabelClick}
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    default:
      return null;
  }
};

VizLegend.displayName = 'Legend';
