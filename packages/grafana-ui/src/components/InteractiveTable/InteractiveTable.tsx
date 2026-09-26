import { css, cx } from '@emotion/css';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Header,
  useReactTable,
} from '@tanstack/react-table';
import { Fragment, type ReactNode, useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { type GrafanaTheme2, type IconName, isTruthy } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Pagination } from '../Pagination/Pagination';
import { Tooltip } from '../Tooltip/Tooltip';
import { type PopoverContent } from '../Tooltip/types';

import { type Column } from './types';
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

export type ColumnSort = { id: string; desc: boolean };
export type FetchDataArgs<Data> = { sortBy: ColumnSort[] };
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
  getRowId: (originalRow: TableData, index: number) => string;
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
  initialSortBy?: ColumnSort[];
  /**
   * Disable the ability to remove sorting on columns (none -> asc -> desc -> asc)
   */
  disableSortRemove?: boolean;
  /**
   * Will automatically reset to the first page if the `data` prop is changed
   */
  autoResetPage?: boolean;
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

/**
 * The InteractiveTable is used to display and select data efficiently. It allows for the display and modification of detailed information.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/layout-interactivetable--docs
 */
export function InteractiveTable<TableData extends object>({
  autoResetPage,
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
  disableSortRemove,
}: Props<TableData>) {
  const styles = useStyles2(getStyles);
  const tableColumns = useMemo(() => {
    return getColumns<TableData>(columns, showExpandAll);
  }, [columns, showExpandAll]);
  const id = useId();
  const getRowHTMLID = useCallback((rowId: string) => `${id}-${rowId}`.replace(/\s/g, ''), [id]);

  const multiplePages = data.length > pageSize;
  const paginationEnabled = pageSize > 0;

  const tableInstance = useReactTable<TableData>({
    columns: tableColumns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: paginationEnabled ? getPaginationRowModel() : undefined,
    autoResetExpanded: false,
    // Resetting the page index is handled in an effect below, TanStack Table resets it outside of the React lifecycle
    autoResetPageIndex: false,
    // Rows are expandable through renderExpandedRow, they never have sub rows
    getRowCanExpand: () => Boolean(renderExpandedRow),
    enableMultiSort: false,
    // TanStack Table sorts number columns descending first; v7 always started ascending
    sortDescFirst: false,
    manualSorting: Boolean(fetchData),
    enableSortingRemoval: !disableSortRemove,
    getRowId,
    meta: { getRowHTMLID },
    initialState: {
      columnVisibility: Object.fromEntries(
        [
          !renderExpandedRow && EXPANDER_CELL_ID,
          ...tableColumns
            .filter((col) => !(col.meta?.visible ? col.meta.visible(data) : true))
            .map((c) => c.id)
            .filter(isTruthy),
        ]
          .filter(isTruthy)
          .map((columnId) => [columnId, false])
      ),
      sorting: initialSortBy,
      pagination: { pageIndex: 0, pageSize: paginationEnabled ? pageSize : 10 },
    },
  });

  const { sorting: sortBy } = tableInstance.getState();
  useEffect(() => {
    if (fetchData) {
      fetchData({ sortBy });
    }
  }, [sortBy, fetchData]);

  useEffect(() => {
    if (paginationEnabled) {
      tableInstance.setPageSize(pageSize);
    }
  }, [paginationEnabled, pageSize, tableInstance]);

  const previousData = useRef(data);
  useEffect(() => {
    const dataChanged = previousData.current !== data;
    previousData.current = data;

    if (autoResetPage && dataChanged) {
      tableInstance.setPageIndex(0);
    }
  }, [autoResetPage, data, tableInstance]);

  return (
    <div className={styles.container}>
      <table className={cx(styles.table, className)}>
        <thead>
          {tableInstance.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const headerTooltip = headerTooltips?.[header.column.id];

                return (
                  <th
                    key={header.id}
                    // react-table v7 set this. Without it, the custom variable preview cannot find its headers.
                    role="columnheader"
                    colSpan={header.colSpan}
                    className={cx(styles.header, header.column.columnDef.meta?.widthClass, {
                      [styles.disableGrow]: header.column.columnDef.size === 0,
                      [styles.sortableHeader]: header.column.getCanSort(),
                    })}
                    {...(header.column.getIsSorted() && {
                      'aria-sort': header.column.getIsSorted() === 'desc' ? 'descending' : 'ascending',
                    })}
                  >
                    <ColumnHeader header={header} headerTooltip={headerTooltip} />
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {tableInstance.getRowModel().rows.map((row) => {
            const rowId = getRowHTMLID(row.id);
            const isExpanded = row.getIsExpanded();

            return (
              <Fragment key={row.id}>
                <tr className={cx(styles.row, isExpanded && styles.expandedRow)}>
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <td key={cell.id} className={cx(styles.cell, cell.column.columnDef.meta?.widthClass)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && renderExpandedRow && (
                  <tr id={rowId} className={styles.expandedContentRow}>
                    <td className={styles.expandedContentCell} colSpan={row.getVisibleCells().length}>
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
            currentPage={tableInstance.getState().pagination.pageIndex + 1}
            numberOfPages={tableInstance.getPageCount()}
            onNavigate={(toPage) => tableInstance.setPageIndex(toPage - 1)}
          />
        </span>
      )}
    </div>
  );
}

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
  header,
  headerTooltip,
}: {
  header: Header<T, unknown>;
  headerTooltip?: InteractiveTableHeaderTooltip;
}) {
  const styles = useStyles2(getColumnHeaderStyles);
  const { column } = header;
  const canSort = column.getCanSort();
  const isSorted = column.getIsSorted();
  const headerContent = column.columnDef.header;

  const children = (
    <>
      {flexRender(headerContent, header.getContext())}
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
          <Icon name={isSorted === 'desc' ? 'angle-down' : 'angle-up'} />
        </span>
      )}
    </>
  );

  if (canSort) {
    return (
      <button
        aria-label={t('grafana-ui.interactive-table.aria-label-sort-column', 'Sort column {{columnName}}', {
          columnName: typeof headerContent === 'string' ? headerContent : column.id,
        })}
        type="button"
        onClick={column.getToggleSortingHandler()}
      >
        {children}
      </button>
    );
  }

  return children;
}
