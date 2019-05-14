import React, { useContext } from 'react';
import { css, cx } from 'emotion';
import { LegendSeriesIcon } from '../Legend/LegendSeriesIcon';
import { LegendItem } from '../Legend/Legend';
import { SeriesColorChangeHandler } from './GraphWithLegend';
import { LegendStatsList } from '../Legend/LegendStatsList';
import { ThemeContext } from '../../themes/ThemeContext';

export interface GraphLegendItemProps {
  key?: React.Key;
  item: LegendItem;
  className?: string;
  onLabelClick?: (item: LegendItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onToggleAxis?: () => void;
}

export const GraphLegendListItem: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
}) => {
  const theme = useContext(ThemeContext);

  return (
    <>
      <LegendSeriesIcon
        disabled={!onSeriesColorChange}
        color={item.color}
        onColorChange={color => {
          if (onSeriesColorChange) {
            onSeriesColorChange(item.label, color);
          }
        }}
        onToggleAxis={onToggleAxis}
        yAxis={item.yAxis}
      />
      <div
        onClick={event => {
          if (onLabelClick) {
            onLabelClick(item, event);
          }
        }}
        className={css`
          cursor: pointer;
          white-space: nowrap;
          color: ${!item.isVisible && theme.colors.linkDisabled};
        `}
      >
        {item.label}
      </div>

      {item.displayValues && <LegendStatsList stats={item.displayValues} />}
    </>
  );
};

export const GraphLegendTableRow: React.FunctionComponent<GraphLegendItemProps> = ({
  item,
  onSeriesColorChange,
  onToggleAxis,
  onLabelClick,
  className,
}) => {
  const theme = useContext(ThemeContext);

  return (
    <tr
      className={cx(
        css`
          font-size: ${theme.typography.size.sm};
          td {
            padding: ${theme.spacing.xxs} ${theme.spacing.sm};
            white-space: nowrap;
          }
        `,
        className
      )}
    >
      <td>
        <span
          className={css`
            display: flex;
            white-space: nowrap;
          `}
        >
          <LegendSeriesIcon
            disabled={!!onSeriesColorChange}
            color={item.color}
            onColorChange={color => {
              if (onSeriesColorChange) {
                onSeriesColorChange(item.label, color);
              }
            }}
            onToggleAxis={onToggleAxis}
            yAxis={item.yAxis}
          />
          <div
            onClick={event => {
              if (onLabelClick) {
                onLabelClick(item, event);
              }
            }}
            className={css`
              cursor: pointer;
              white-space: nowrap;
            `}
          >
            {item.label}{' '}
            {item.yAxis === 2 && (
              <span
                className={css`
                  color: ${theme.colors.gray2};
                `}
              >
                (right y-axis)
              </span>
            )}
          </div>
        </span>
      </td>
      {item.displayValues &&
        item.displayValues.map((stat, index) => {
          return (
            <td
              className={css`
                text-align: right;
              `}
              key={`${stat.title}-${index}`}
            >
              {stat.text}
            </td>
          );
        })}
    </tr>
  );
};
