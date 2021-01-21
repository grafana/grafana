import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { VizLegendTableProps } from './types';
import { Icon } from '../Icon/Icon';
import { useStyles } from '../../themes/ThemeContext';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import { LegendTableItem } from './VizLegendTableItem';
import { GrafanaTheme } from '@grafana/data';

export const VizLegendTable: FC<VizLegendTableProps> = ({
  items,
  sortBy: sortKey,
  sortDesc,
  itemRenderer,
  className,
  onToggleSort,
  onLabelClick,
  onSeriesColorChange,
}) => {
  const styles = useStyles(getStyles);

  const columns = items
    .map((item) => {
      if (item.getDisplayValues) {
        return item.getDisplayValues().map((i) => i.title);
      }
      return [];
    })
    .reduce(
      (acc, current) => {
        return union(
          acc,
          current.filter((item) => !!item)
        );
      },
      ['']
    ) as string[];

  const sortedItems = sortKey
    ? sortBy(items, (item) => {
        if (item.getDisplayValues) {
          const stat = item.getDisplayValues().filter((stat) => stat.title === sortKey)[0];
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
        onSeriesColorChange={onSeriesColorChange}
        onLabelClick={onLabelClick}
      />
    );
  }

  return (
    <table className={cx(styles.table, className)}>
      <thead>
        <tr>
          {columns.map((columnHeader) => {
            return (
              <th
                key={columnHeader}
                className={cx(styles.header, onToggleSort && styles.headerSortable)}
                onClick={() => {
                  if (onToggleSort) {
                    onToggleSort(columnHeader);
                  }
                }}
              >
                {columnHeader}
                {sortKey === columnHeader && (
                  <Icon className={styles.sortIcon} name={sortDesc ? 'angle-down' : 'angle-up'} />
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

const getStyles = (theme: GrafanaTheme) => ({
  table: css`
    width: 100%;
    margin-left: ${theme.spacing.sm};
  `,
  header: css`
    color: ${theme.colors.textBlue};
    font-weight: ${theme.typography.weight.semibold};
    border-bottom: 1px solid ${theme.colors.border1};
    padding: ${theme.spacing.xxs} ${theme.spacing.sm};
    text-align: right;
  `,
  headerSortable: css`
    cursor: pointer;
  `,
  sortIcon: css`
    margin-left: ${theme.spacing.sm};
  `,
});
