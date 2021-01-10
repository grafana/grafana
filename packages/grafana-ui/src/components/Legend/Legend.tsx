import React from 'react';
import { LegendProps, LegendDisplayMode } from './types';
import { LegendTable } from './LegendTable';
import { LegendList } from './LegendList';

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
  switch (displayMode) {
    case LegendDisplayMode.Table:
      return (
        <LegendTable
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
        <LegendList
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
