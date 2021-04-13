import React from 'react';
import { LegendProps } from './types';
import { LegendDisplayMode } from './models.gen';
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
  itemRenderer,
}: LegendProps<T>) {
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
          onSeriesColorChange={onSeriesColorChange}
          itemRenderer={itemRenderer}
        />
      );
    case LegendDisplayMode.List:
      return (
        <VizLegendList<T>
          className={className}
          items={items}
          placement={placement}
          onLabelClick={onLabelClick as any}
          onSeriesColorChange={onSeriesColorChange}
          itemRenderer={itemRenderer}
        />
      );
    default:
      return null;
  }
}

VizLegend.displayName = 'Legend';
