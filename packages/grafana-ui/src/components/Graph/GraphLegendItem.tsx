import React from 'react';
import { css } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';
import { SeriesColorChangeHandler } from './GraphWithLegend';

interface GraphLegendItemProps {
  item: LegendItem;
  onLabelClick: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange: SeriesColorChangeHandler;
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
      <LegendSeriesIcon
        color={item.color}
        onColorChange={color => onSeriesColorChange(item.label, color)}
        onToggleAxis={onToggleAxis}
        useRightYAxis={item.useRightYAxis}
      />
      <div
        onClick={event => onLabelClick(item, event)}
        className={css`
          cursor: pointer;
          white-space: nowrap;
        `}
      >
        {item.label}
      </div>
    </>
  );
};
