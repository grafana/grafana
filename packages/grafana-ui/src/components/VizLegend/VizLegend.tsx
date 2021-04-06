import React from 'react';
import { LegendProps, LegendDisplayMode } from './types';
import { VizLegendTable } from './VizLegendTable';
import { VizLegendList } from './VizLegendList';

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
  onSeriesColorChange,
  placement,
  className,
}: LegendProps<T>) {
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
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    case LegendDisplayMode.List:
      return (
        <VizLegendList
          className={className}
          items={items}
          placement={placement}
          onLabelClick={onLabelClick}
          onSeriesColorChange={onSeriesColorChange}
        />
      );
    default:
      return null;
  }
};

VizLegend.displayName = 'Legend';
