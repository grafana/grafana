import React, { useContext } from 'react';
import { css } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';
import { SeriesColorChangeHandler } from './GraphWithLegend';
import { LegendStatsList } from '../Legend/LegendStatsList';
import { ThemeContext } from '../../themes/ThemeContext';

interface GraphLegendItemProps {
  item: LegendItem;
  onLabelClick: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange: SeriesColorChangeHandler;
  onToggleAxis: () => void;
}

export const GraphLegendListItem: React.FunctionComponent<GraphLegendItemProps> = ({
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

      {item.info && <LegendStatsList stats={item.info} />}
    </>
  );
};

export const GraphLegendTableItem: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
}) => {
  const theme = useContext(ThemeContext);
  return (
    <>
      <td>
        <span
          className={css`
            padding-left: 10px;
            display: flex;
            font-size: ${theme.typography.size.sm};
            white-space: nowrap;
          `}
        >
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
        </span>
      </td>
      {item.info &&
        item.info.map(stat => {
          return <td>{stat.text}</td>;
        })}
    </>
  );
};
