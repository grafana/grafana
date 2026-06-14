import { css, cx } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type LegendPlacement } from '@grafana/schema';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { useLimit } from '../List/hooks';

import { LegendTableItem } from './VizLegendTableItem';
import { type VizLegendItem, type VizLegendTableProps } from './types';

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
  limit = 0,
  filterAction,
  placement,
  overflow
}: VizLegendTableProps<T>): JSX.Element => {
  const styles = useStyles2(getStyles, placement);
  const header: Record<string, string> = {
    [nameSortKey]: '',
  };

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
      items.sort((a, b) => {
        return sortMult * naturalCompare(a.label, b.label);
      });
    } else {
      items.sort((a, b) => {
        const aVal = itemVals.get(a) ?? 0;
        const bVal = itemVals.get(b) ?? 0;

        return sortMult * (aVal - bVal);
      });
    }
  }

  const [curLimit, setLimit] = useLimit(limit);

  const limitedItems = useMemo(() => (curLimit > 0 ? items.slice(0, curLimit) : items), [items, curLimit]);

  const hasMixedAxes = useMemo(() => {
    const firstYAxis = items[0]?.yAxis ?? 1;
    return items.some((item) => item.yAxis !== firstYAxis);
  }, [items]);

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item, index) => (
      <LegendTableItem
        key={`${item.label}-${index}`}
        item={item}
        onLabelClick={onLabelClick}
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
        hasMixedAxes={hasMixedAxes}
        overflow={overflow}
      />
    );
  }

  return (
    <>
      <table
        className={cx(styles.grid, className)}
        style={{
          gridTemplateColumns: `min-content minmax(55px, auto) ${'min-content '.repeat(Object.keys(header).length - 1)}`,
        }}
      >
        <thead className={styles.header}>
          <tr>
            <th>
              <span className="sr-only">
                <Trans i18nKey={'legend.container.series-color-and-icon'}>Series color</Trans>
              </span>
            </th>
            {Object.keys(header).map((columnTitle, i) => (
              <th
                {...(sortKey === columnTitle ? { 'aria-sort': sortDesc ? 'descending' : 'ascending' } : null)}
                title={header[columnTitle]}
                key={columnTitle}
                className={cx({
                  [styles.headerSortable]: Boolean(onToggleSort),
                  [styles.nameHeader]: isSortable,
                  [styles.calcHeader]: i > 0,
                  [styles.withIcon]: sortKey === columnTitle,
                  'sr-only': !isSortable,
                })}
                onClick={() => {
                  if (onToggleSort && isSortable) {
                    onToggleSort(columnTitle);
                  }
                }}
              >
                {columnTitle === nameSortKey && filterAction && (
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <span className={styles.filterAction} onClick={(e) => e.stopPropagation()}>
                    {filterAction}
                  </span>
                )}
                {columnTitle}
                {sortKey === columnTitle && <Icon size="xs" name={sortDesc ? 'angle-down' : 'angle-up'} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{limitedItems.map(itemRenderer!)}</tbody>
      </table>
      {curLimit > 0 && items.length > curLimit && (
        <Button fill="text" variant="primary" size="sm" onClick={() => setLimit(0)} className={styles.showAll}>
          <Trans i18nKey={'legend.container.show-all-series'} className={styles.showAll}>
            ...show all {{ total: items.length }} items
          </Trans>
        </Button>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2, placement: LegendPlacement = 'bottom') => ({
  header: css({
    position: 'sticky',
    top: 0,
    backgroundColor: theme.colors.background.primary,

    color: theme.colors.primary.text,
  }),
  nameHeader: css({
    textAlign: 'left',
  }),
  calcHeader: css({
    textAlign: 'right',
  }),
  withIcon: css({
    paddingRight: '4px',
  }),
  headerSortable: css({
    cursor: 'pointer',
  }),
  filterAction: css({
    marginLeft: theme.spacing(0.5),
    display: 'inline-flex',
    verticalAlign: 'middle',
  }),
  showAll: css({
    justifyContent: 'right',
  }),

  grid: css({
    display: 'grid',
    width: '100%',

    // non-layout
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'right',
    whiteSpace: 'nowrap',

    'tbody,thead,tfoot,tr': {
      display: 'grid',
      gridColumn: '1 / -1',
      gridTemplateColumns: 'subgrid',
    },

    tr: {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },

    'th,td': {
      display: 'block',
      alignContent: 'center',
      whiteSpace: 'nowrap',

      // non-layout
      padding: theme.spacing(0.25, 1),

      // series color/icon column
      '&:nth-child(1)': {
        paddingLeft: theme.spacing(1),
      },

      // series name column
      '&:nth-child(2)': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: placement === 'right' ? 600 : undefined,
      },
    },
  }),
});
