import React from 'react';
import { LegendProps, LegendItem } from '../Legend/Legend';
import { GraphLegendListItem, GraphLegendTableItem } from './GraphLegendItem';
import { SeriesColorChangeHandler, SeriesAxisToggleHandler } from './GraphWithLegend';
import { LegendTable } from '../Legend/LegendTable';
import { LegendList } from '../Legend/LegendList';
import union from 'lodash/union';

interface GraphLegendProps extends LegendProps {
  renderLegendAsTable?: boolean;
  sortBy?: string;
  sortDesc?: boolean;
  onSeriesColorChange: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
  onToggleSort: (sortBy: string, sortDesc: boolean) => void;
  onLabelClick: (item: LegendItem, event: React.MouseEvent<HTMLElement>) => void;
}

export const GraphLegend: React.FunctionComponent<GraphLegendProps> = ({
  items,
  renderLegendAsTable,
  sortBy,
  sortDesc,
  onToggleSort,
  onSeriesAxisToggle,
  placement,
  ...graphLegendItemProps
}) => {
  if (renderLegendAsTable) {
    const columns = items
      .map(item => {
        if (item.info) {
          return item.info.map(i => i.title);
        }
        return [];
      })
      .reduce(
        (acc, current) => {
          return union(acc, current.filter(item => !!item));
        },
        ['']
      ) as string[];

    return (
      <LegendTable
        items={items}
        columns={columns}
        placement={placement}
        sortBy={sortBy}
        sortDesc={sortDesc}
        itemRenderer={item => (
          <GraphLegendTableItem
            item={item}
            onToggleAxis={() => {
              if (onSeriesAxisToggle) {
                onSeriesAxisToggle(item.label, !item.useRightYAxis);
              }
            }}
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
              onSeriesAxisToggle(item.label, !item.useRightYAxis);
            }
          }}
          {...graphLegendItemProps}
        />
      )}
    />
    // <Legend
    //   items={items}
    // itemRenderer={item => (
    //   <GraphLegendListItem
    //     item={item}
    //     onToggleAxis={() => {
    //       if (onSeriesAxisToggle) {
    //         onSeriesAxisToggle(item.label, !item.useRightYAxis);
    //       }
    //     }}
    //     {...graphLegendItemProps}
    //   />
    // )}
    //   onToggleSort={onToggleSort}
    //   renderLegendAs={renderLegendAs}
    //   placement={placement}
    // />
  );
};
