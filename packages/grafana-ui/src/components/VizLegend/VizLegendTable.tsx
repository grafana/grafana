import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

import { LegendTableItem } from './VizLegendTableItem';
import { VizLegendItem, VizLegendTableProps } from './types';

const nameSortKey = 'Name';
const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

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
  onLabelMouseOver,
  onLabelMouseOut,
  readonly,
  isSortable,
}: VizLegendTableProps<T>): JSX.Element => {
  const styles = useStyles2(getStyles);
  const header: Record<string, string> = {};

  if (isSortable) {
    header[nameSortKey] = '';
  }

  for (const item of items) {
    if (item.getDisplayValues) {
      for (const displayValue of item.getDisplayValues()) {
        header[displayValue.title ?? '?'] = displayValue.description ?? '';
      }
    }
  }

  if (sortKey != null) {
    let itemVals = new Map<VizLegendItem, number>();

    items.forEach((item) => {
      if (sortKey !== nameSortKey && item.getDisplayValues) {
        const stat = item.getDisplayValues().find((stat) => stat.title === sortKey);
        const val = stat == null || Number.isNaN(stat.numeric) ? -Infinity : stat.numeric;
        itemVals.set(item, val);
      }
    });

    let sortMult = sortDesc ? -1 : 1;

    if (sortKey === nameSortKey) {
      // string sort
      items.sort((a, b) => {
        return sortMult * naturalCompare(a.label, b.label);
      });
    } else {
      // numeric sort
      items.sort((a, b) => {
        const aVal = itemVals.get(a) ?? 0;
        const bVal = itemVals.get(b) ?? 0;

        return sortMult * (aVal - bVal);
      });
    }
  }

  if (!itemRenderer) {
    itemRenderer = (item, index) => (
      <LegendTableItem
        key={`${item.label}-${index}`}
        item={item}
        onLabelClick={onLabelClick}
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
      />
    );
  }

  return (
    <table className={cx(styles.table, className)}>
      <thead>
        <tr>
          {!isSortable && <th></th>}
          {Object.keys(header).map((columnTitle) => (
            <th
              title={header[columnTitle]}
              key={columnTitle}
              className={cx(styles.header, onToggleSort && styles.headerSortable, isSortable && styles.nameHeader, {
                [styles.withIcon]: sortKey === columnTitle,
              })}
              onClick={() => {
                if (onToggleSort) {
                  onToggleSort(columnTitle);
                }
              }}
            >
              {columnTitle}
              {sortKey === columnTitle && <Icon size="xs" name={sortDesc ? 'angle-down' : 'angle-up'} />}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{items.map(itemRenderer!)}</tbody>
    </table>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    'th:first-child': {
      width: '100%',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  header: css({
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.25, 1, 0.25, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }),
  nameHeader: css({
    textAlign: 'left',
    paddingLeft: '30px',
  }),
  // This needs to be padding-right - icon size(xs==12) to avoid jumping
  withIcon: css({
    paddingRight: '4px',
  }),
  headerSortable: css({
    cursor: 'pointer',
  }),
});
