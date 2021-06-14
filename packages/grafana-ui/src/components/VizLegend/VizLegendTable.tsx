import React from 'react';
import { css, cx } from '@emotion/css';
import { VizLegendTableProps } from './types';
import { Icon } from '../Icon/Icon';
import { useStyles2 } from '../../themes/ThemeContext';
import { union, sortBy } from 'lodash';
import { LegendTableItem } from './VizLegendTableItem';
import { GrafanaTheme2 } from '@grafana/data';

/**
 * @internal
 */
export const VizLegendTable = <T extends unknown>({
  items,
  sortBy: sortKey,
  sortDesc,
  itemRenderer,
  className,
  onToggleSort,
  onLabelClick,
  onLabelMouseEnter,
  onLabelMouseOut,
  readonly,
}: VizLegendTableProps<T>): JSX.Element => {
  const styles = useStyles2(getStyles);

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
        onLabelClick={onLabelClick}
        onLabelMouseEnter={onLabelMouseEnter}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
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

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;
    th:first-child {
      width: 100%;
    }
  `,
  header: css`
    color: ${theme.colors.primary.text};
    font-weight: ${theme.typography.fontWeightMedium};
    border-bottom: 1px solid ${theme.colors.border.weak};
    padding: ${theme.spacing(0.25, 1)};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-align: right;
    white-space: nowrap;
  `,
  headerSortable: css`
    cursor: pointer;
  `,
  sortIcon: css`
    margin-left: ${theme.spacing(1)};
  `,
});
