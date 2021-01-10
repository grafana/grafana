import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { LegendTableProps } from './types';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes/ThemeContext';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import { LegendTableItem } from './LegendTableItem';

export const LegendTable: FC<LegendTableProps> = ({
  items,
  sortBy: sortKey,
  sortDesc,
  itemRenderer,
  className,
  onToggleSort,
  onSeriesAxisToggle,
  onLabelClick,
  onSeriesColorChange,
}) => {
  const theme = useTheme();

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

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item, index) => (
      <LegendTableItem
        key={`${item.label}-${index}`}
        item={item}
        onSeriesAxisToggle={onSeriesAxisToggle}
        onSeriesColorChange={onSeriesColorChange}
        onLabelClick={onLabelClick}
      />
    );
  }

  return (
    <table
      className={cx(
        css`
          width: 100%;
          td {
            padding: 2px 10px;
          }
        `,
        className
      )}
    >
      <thead>
        <tr>
          {columns.map(columnHeader => {
            return (
              <th
                key={columnHeader}
                className={css`
                  color: ${theme.colors.textBlue};
                  font-weight: bold;
                  text-align: right;
                  cursor: pointer;
                `}
                onClick={() => {
                  if (onToggleSort) {
                    onToggleSort(columnHeader);
                  }
                }}
              >
                {columnHeader}
                {sortKey === columnHeader && (
                  <Icon
                    className={css`
                      margin-left: ${theme.spacing.sm};
                    `}
                    name={sortDesc ? 'angle-down' : 'angle-up'}
                  />
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{sortedItems.map(itemRenderer!)}</tbody>
    </table>
  );
};
