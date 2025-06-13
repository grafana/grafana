import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { Fragment, ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  HeaderGroup,
  PluginHook,
  Row,
  SortingRule,
  TableOptions,
  useExpanded,
  usePagination,
  useSortBy,
  useTable,
} from 'react-table';

import { GrafanaTheme2, IconName, isTruthy } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Pagination } from '../Pagination/Pagination';
import { Tooltip } from '../Tooltip/Tooltip';
import { PopoverContent } from '../Tooltip/types';

import { Column } from './types';
import { EXPANDER_CELL_ID, getColumns } from './utils';

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(2),
      flexDirection: 'column',
      width: '100%',
      overflowX: 'auto',
    }),
    cell: css({
      padding: theme.spacing(1),
      minWidth: theme.spacing(3),
    }),
    table: css({
      borderRadius: theme.shape.radius.default,
      width: '100%',
    }),
    disableGrow: css({
      width: 0,
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minWidth: theme.spacing(3),
      '&, & > button': {
        position: 'relative',
        whiteSpace: 'nowrap',
        padding: theme.spacing(1),
      },
      '& > button': {
        '&:after': {
          content: '"\\00a0"',
        },
        width: '100%',
        height: '100%',
        background: 'none',
        border: 'none',
        paddingRight: theme.spacing(2.5),
        textAlign: 'left',
        fontWeight: theme.typography.fontWeightMedium,
      },
    }),
    row: css({
      label: 'row',
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      '&:hover': {
        backgroundColor: rowHoverBg,
      },

      '&:last-child': {
        borderBottom: 0,
      },
    }),
    expandedRow: css({
      label: 'expanded-row-content',
      borderBottom: 'none',
    }),
    expandedContentCell: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      position: 'relative',
      padding: theme.spacing(2, 2, 2, 5),

      '&:before': {
        content: '""',
        position: 'absolute',
        width: '1px',
        top: 0,
        left: '16px',
        bottom: theme.spacing(2),
        background: theme.colors.border.medium,
      },
    }),
    expandedContentRow: css({
      label: 'expanded-row-content',
    }),
    sortableHeader: css({
      /* increases selector's specificity so that it always takes precedence over default styles  */
      '&&': {
        padding: 0,
      },
    }),
  };
};

export type InteractiveTableHeaderTooltip = {
  content: PopoverContent;
  iconName?: IconName;
};

export type FetchDataArgs<Data> = { sortBy: Array<SortingRule<Data>> };
export type FetchDataFunc<Data> = ({ sortBy }: FetchDataArgs<Data>) => void;

interface BaseProps<TableData extends object> {
  className?: string;
  /**
   * Table's columns definition. Must be memoized.
   */
  columns: Array<Column<TableData>>;
  /**
   * The data to display in the table. Must be memoized.
   */
  data: TableData[];
  /**
   * Must return a unique id for each row
   */
  getRowId: TableOptions<TableData>['getRowId'];
  /**
   * Optional tooltips for the table headers. The key must match the column id.
   */
  headerTooltips?: Record<string, InteractiveTableHeaderTooltip>;
  /**
   * Number of rows per page. A value of zero disables pagination. Defaults to 0.
   * A React hooks error will be thrown if pageSize goes from greater than 0 to 0 or vice versa. If enabling pagination,
   * make sure pageSize remains a non-zero value.
   */
  pageSize?: number;
  /**
   * A custom function to fetch data when the table is sorted. If not provided, the table will be sorted client-side.
   * It's important for this function to have a stable identity, e.g. being wrapped into useCallback to prevent unnecessary
   * re-renders of the table.
   */
  fetchData?: FetchDataFunc<TableData>;
  /**
   * Optional way to set how the table is sorted from the beginning. Must be memoized.
   */
  initialSortBy?: Array<SortingRule<TableData>>;
}

interface WithExpandableRow<TableData extends object> extends BaseProps<TableData> {
  /**
   * Render function for the expanded row. if not provided, the tables rows will not be expandable.
   */
  renderExpandedRow: (row: TableData) => ReactNode;
  /**
   * Whether to show the "Expand all" button. Depends on renderExpandedRow to be provided. Defaults to false.
   */
  showExpandAll?: boolean;
}

interface WithoutExpandableRow<TableData extends object> extends BaseProps<TableData> {
  renderExpandedRow?: never;
  showExpandAll?: never;
}

type Props<TableData extends object> = WithExpandableRow<TableData> | WithoutExpandableRow<TableData>;

/** @alpha */
export function InteractiveTable<TableData extends object>({
  className,
  columns,
  data,
  getRowId,
  headerTooltips,
  pageSize = 0,
  renderExpandedRow,
  showExpandAll = false,
  fetchData,
  initialSortBy = [],
}: Props<TableData>) {
  const styles = useStyles2(getStyles);
  const tableColumns = useMemo(() => {
    return getColumns<TableData>(columns, showExpandAll);
  }, [columns, showExpandAll]);
  const id = useUniqueId();
  const getRowHTMLID = useCallback(
    (row: Row<TableData>) => {
      return `${id}-${row.id}`.replace(/\s/g, '');
    },
    [id]
  );

  const tableHooks: Array<PluginHook<TableData>> = [useSortBy, useExpanded];

  const multiplePages = data.length > pageSize;
  const paginationEnabled = pageSize > 0;

  if (paginationEnabled) {
    tableHooks.push(usePagination);
  }

  const tableInstance = useTable<TableData>(
    {
      columns: tableColumns,
      data,
      autoResetExpanded: false,
      autoResetSortBy: false,
      disableMultiSort: true,
      // If fetchData is provided, we disable client-side sorting
      manualSortBy: Boolean(fetchData),
      getRowId,
      initialState: {
        hiddenColumns: [
          !renderExpandedRow && EXPANDER_CELL_ID,
          ...tableColumns
            .filter((col) => !(col.visible ? col.visible(data) : true))
            .map((c) => c.id)
            .filter(isTruthy),
        ].filter(isTruthy),
        sortBy: initialSortBy,
      },
    },
    ...tableHooks
  );

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow } = tableInstance;

  const { sortBy } = tableInstance.state;
  useEffect(() => {
    if (fetchData) {
      fetchData({ sortBy });
    }
  }, [sortBy, fetchData]);

  useEffect(() => {
    if (paginationEnabled) {
      tableInstance.setPageSize(pageSize);
    }
  }, [paginationEnabled, pageSize, tableInstance.setPageSize, tableInstance]);

  return (
    <div className={styles.container}>
      <table {...getTableProps()} className={cx(styles.table, className)}>
        <thead>
          {headerGroups.map((headerGroup) => {
            const { key, ...headerRowProps } = headerGroup.getHeaderGroupProps();

            return (
              <tr key={key} {...headerRowProps}>
                {headerGroup.headers.map((column) => {
                  const { key, ...headerCellProps } = column.getHeaderProps();

                  const headerTooltip = headerTooltips?.[column.id];

                  return (
                    <th
                      key={key}
                      className={cx(styles.header, {
                        [styles.disableGrow]: column.width === 0,
                        [styles.sortableHeader]: column.canSort,
                      })}
                      {...headerCellProps}
                      {...(column.isSorted && { 'aria-sort': column.isSortedDesc ? 'descending' : 'ascending' })}
                    >
                      <ColumnHeader column={column} headerTooltip={headerTooltip} />
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </thead>

        <tbody {...getTableBodyProps()}>
          {(paginationEnabled ? tableInstance.page : tableInstance.rows).map((row) => {
            prepareRow(row);

            const { key, ...otherRowProps } = row.getRowProps();
            const rowId = getRowHTMLID(row);
            // @ts-expect-error react-table doesn't ship with useExpanded types, and we can't use declaration merging without affecting the table viz
            const isExpanded = row.isExpanded;

            return (
              <Fragment key={key}>
                <tr {...otherRowProps} className={cx(styles.row, isExpanded && styles.expandedRow)}>
                  {row.cells.map((cell) => {
                    const { key, ...otherCellProps } = cell.getCellProps();
                    return (
                      <td className={styles.cell} key={key} {...otherCellProps}>
                        {cell.render('Cell', { __rowID: rowId })}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && renderExpandedRow && (
                  <tr {...otherRowProps} id={rowId} className={styles.expandedContentRow}>
                    <td className={styles.expandedContentCell} colSpan={row.cells.length}>
                      {renderExpandedRow(row.original)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {paginationEnabled && multiplePages && (
        <span>
          <Pagination
            currentPage={tableInstance.state.pageIndex + 1}
            numberOfPages={tableInstance.pageOptions.length}
            onNavigate={(toPage) => tableInstance.gotoPage(toPage - 1)}
          />
        </span>
      )}
    </div>
  );
}

const useUniqueId = () => {
  return useMemo(() => uniqueId('InteractiveTable'), []);
};

const getColumnHeaderStyles = (theme: GrafanaTheme2) => ({
  sortIcon: css({
    position: 'absolute',
    top: theme.spacing(1),
  }),
  headerTooltipIcon: css({
    marginLeft: theme.spacing(0.5),
  }),
});

function ColumnHeader<T extends object>({
  column: { canSort, render, isSorted, isSortedDesc, getSortByToggleProps },
  headerTooltip,
}: {
  column: HeaderGroup<T>;
  headerTooltip?: InteractiveTableHeaderTooltip;
}) {
  const styles = useStyles2(getColumnHeaderStyles);
  const { onClick } = getSortByToggleProps();

  const children = (
    <>
      {render('Header')}
      {headerTooltip && (
        <Tooltip theme="info-alt" content={headerTooltip.content} placement="top-end">
          <Icon
            className={styles.headerTooltipIcon}
            name={headerTooltip.iconName || 'info-circle'}
            data-testid={'header-tooltip-icon'}
          />
        </Tooltip>
      )}
      {isSorted && (
        <span aria-hidden="true" className={styles.sortIcon}>
          <Icon name={isSortedDesc ? 'angle-down' : 'angle-up'} />
        </span>
      )}
    </>
  );

  if (canSort) {
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  }

  return children;
}
