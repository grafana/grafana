import React from 'react';
import { css } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';

interface GraphLegendItemProps {
  item: LegendItem;
  onLabelClick: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange: (color: string) => void;
  onToggleAxis: () => void;
}

export const GraphLegendItem: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
}) => {
  return (
    <>
      <LegendSeriesIcon color={item.color} onColorChange={onSeriesColorChange} onToggleAxis={onToggleAxis} />
      <div
        onClick={event => onLabelClick(item, event)}
        className={css`
          cursor: pointer;
        `}
      >
        {item.label}
      </div>
    </>
  );
};
