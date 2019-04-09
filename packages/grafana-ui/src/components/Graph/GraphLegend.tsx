import React from 'react';
import { LegendProps, Legend, LegendItem } from '../Legend/Legend';
import { GraphLegendItem } from './GraphLegendItem';

interface GraphLegendProps extends LegendProps {
  onSeriesColorChange: (color: string) => void; // TODO: fix type
  onToggleAxis: () => void;
  onToggleSort?: (sortBy: string, sortDesc: boolean) => void;
  onLabelClick: (item: LegendItem) => void;
}

export const GraphLegend: React.FunctionComponent<GraphLegendProps> = ({
  items,
  renderLegendAs,
  statsToDisplay,
  onToggleSort,
  ...graphLegendItemProps
}) => {
  return (
    <Legend
      items={items}
      itemRenderer={item => <GraphLegendItem item={item} {...graphLegendItemProps} />}
      onToggleSort={onToggleSort}
      renderLegendAs={renderLegendAs}
      statsToDisplay={statsToDisplay}
    />
  );
};
