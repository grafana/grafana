import React, { useContext } from 'react';
import { LegendProps, LegendItem, LegendDisplayMode } from '../Legend/Legend';
import { GraphLegendListItem, GraphLegendTableRow } from './GraphLegendItem';
import { SeriesColorChangeHandler, SeriesAxisToggleHandler } from './GraphWithLegend';
import { LegendTable } from '../Legend/LegendTable';
import { LegendList } from '../Legend/LegendList';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import { ThemeContext } from '../../themes/ThemeContext';
import { css } from 'emotion';
import { selectThemeVariant } from '../../themes/index';

export interface GraphLegendProps extends LegendProps {
  displayMode: LegendDisplayMode;
  sortBy?: string;
  sortDesc?: boolean;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
  onToggleSort?: (sortBy: string) => void;
  onLabelClick?: (item: LegendItem, event: React.MouseEvent<HTMLElement>) => void;
}

export const GraphLegend: React.FunctionComponent<GraphLegendProps> = ({
  items,
  displayMode,
  sortBy: sortKey,
  sortDesc,
  onToggleSort,
  onSeriesAxisToggle,
  placement,
  className,
  ...graphLegendItemProps
}) => {
  const theme = useContext(ThemeContext);

  if (displayMode === LegendDisplayMode.Table) {
    const columns = items
      .map(item => {
        if (item.displayValues) {
          return item.displayValues.map(i => i.title);
        }
        return [];
      })
      .reduce(
        (acc, current) => {
          return union(
            acc,
            current.filter(item => !!item)
          );
        },
        ['']
      ) as string[];

    const sortedItems = sortKey
      ? sortBy(items, item => {
          if (item.displayValues) {
            const stat = item.displayValues.filter(stat => stat.title === sortKey)[0];
            return stat && stat.numeric;
          }
          return undefined;
        })
      : items;

    const legendTableEvenRowBackground = selectThemeVariant(
      {
        dark: theme.palette.dark6,
        light: theme.palette.gray5,
      },
      theme.type
    );

    return (
      <LegendTable
        className={css`
          font-size: ${theme.typography.size.sm};
          th {
            padding: ${theme.spacing.xxs} ${theme.spacing.sm};
          }
        `}
        items={sortDesc ? sortedItems.reverse() : sortedItems}
        columns={columns}
        placement={placement}
        sortBy={sortKey}
        sortDesc={sortDesc}
        itemRenderer={(item, index) => (
          <GraphLegendTableRow
            key={`${item.label}-${index}`}
            item={item}
            onToggleAxis={() => {
              if (onSeriesAxisToggle) {
                onSeriesAxisToggle(item.label, item.yAxis === 1 ? 2 : 1);
              }
            }}
            className={css`
              background: ${index % 2 === 0 ? legendTableEvenRowBackground : 'none'};
            `}
            {...graphLegendItemProps}
          />
        )}
        onToggleSort={onToggleSort}
      />
    );
  }
  return (
    <LegendList
      items={items}
      placement={placement}
      itemRenderer={item => (
        <GraphLegendListItem
          item={item}
          onToggleAxis={() => {
            if (onSeriesAxisToggle) {
              onSeriesAxisToggle(item.label, item.yAxis === 1 ? 2 : 1);
            }
          }}
          {...graphLegendItemProps}
        />
      )}
    />
  );
};

GraphLegend.displayName = 'GraphLegend';
