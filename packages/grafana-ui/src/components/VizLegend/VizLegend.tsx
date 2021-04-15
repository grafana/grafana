import React from 'react';
import { LegendProps } from './types';
import { LegendDisplayMode } from './models.gen';
import { VizLegendTable } from './VizLegendTable';
import { VizLegendList } from './VizLegendList';

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
  eventBus,
  onSeriesColorChange,
  placement,
  className,
}) => {
  switch (displayMode) {
    case LegendDisplayMode.Table:
      return (
        <VizLegendTable
          className={className}
          items={items}
          placement={placement}
          sortBy={sortKey}
          sortDesc={sortDesc}
          eventBus={eventBus}
          onLabelClick={onLabelClick}
          onToggleSort={onToggleSort}
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    case LegendDisplayMode.List:
      return (
        <VizLegendList
          className={className}
          items={items}
          placement={placement}
          eventBus={eventBus}
          onLabelClick={onLabelClick}
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    default:
      return null;
  }
};

VizLegend.displayName = 'Legend';
