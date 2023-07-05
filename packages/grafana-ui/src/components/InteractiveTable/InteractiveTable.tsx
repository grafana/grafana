import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { Fragment, ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  HeaderGroup,
  PluginHook,
  Row,
  TableOptions,
  useExpanded,
  usePagination,
  useSortBy,
  useTable,
} from 'react-table';

import { GrafanaTheme2, IconName, isTruthy } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Pagination } from '../Pagination/Pagination';
import { PopoverContent, Tooltip } from '../Tooltip';

import { Column } from './types';
import { EXPANDER_CELL_ID, getColumns } from './utils';

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    container: css`
      display: flex;
      gap: ${theme.spacing(2)};
      flex-direction: column;
      width: 100%;
    `,
    table: css`
      border-radius: ${theme.shape.borderRadius()};
      width: 100%;

      td {
        padding: ${theme.spacing(1)};
      }

      td,
      th {
        min-width: ${theme.spacing(3)};
      }
    `,
    disableGrow: css`
      width: 0;
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      &,
      & > button {
        position: relative;
        white-space: nowrap;
        padding: ${theme.spacing(1)};
      }
      & > button {
        &:after {
          content: '\\00a0';
        }
        width: 100%;
        height: 100%;
        background: none;
        border: none;
        padding-right: ${theme.spacing(2.5)};
        text-align: left;
        font-weight: ${theme.typography.fontWeightMedium};
      }
    `,
    row: css`
      label: row;
      border-bottom: 1px solid ${theme.colors.border.weak};

      &:hover {
        background-color: ${rowHoverBg};
      }

      &:last-child {
        border-bottom: 0;
      }
    `,
    expandedRow: css`
      label: expanded-row-content;
      border-bottom: none;
    `,
    expandedContentRow: css`
      label: expanded-row-content;

      td {
        border-bottom: 1px solid ${theme.colors.border.weak};
        position: relative;
        padding: ${theme.spacing(2, 2, 2, 5)};

        &:before {
          content: '';
          position: absolute;
          width: 1px;
          top: 0;
          left: 16px;
          bottom: ${theme.spacing(2)};
          background: ${theme.colors.border.medium};
        }
      }
    `,
    sortableHeader: css`
      /* increases selector's specificity so that it always takes precedence over default styles  */
      && {
        padding: 0;
      }
    `,
  };
};

export type InteractiveTableHeaderTooltip = {
  content: PopoverContent;
  iconName?: IconName;
};

interface Props<TableData extends object> {
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
   */
  pageSize?: number;
  /**
   * Render function for the expanded row. if not provided, the tables rows will not be expandable.
   */
  renderExpandedRow?: (row: TableData) => ReactNode;
}

/** @alpha */
export function InteractiveTable<TableData extends object>({
  className,
  columns,
  data,
  getRowId,
  headerTooltips,
  pageSize = 0,
  renderExpandedRow,
}: Props<TableData>) {
  const styles = useStyles2(getStyles);
  const tableColumns = useMemo(() => {
    return getColumns<TableData>(columns);
  }, [columns]);
  const id = useUniqueId();
  const getRowHTMLID = useCallback(
    (row: Row<TableData>) => {
      return `${id}-${row.id}`.replace(/\s/g, '');
    },
    [id]
  );

  const tableHooks: Array<PluginHook<TableData>> = [useSortBy, useExpanded];

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
      getRowId,
      initialState: {
        hiddenColumns: [
          !renderExpandedRow && EXPANDER_CELL_ID,
          ...tableColumns
            .filter((col) => !(col.visible ? col.visible(data) : true))
            .map((c) => c.id)
            .filter(isTruthy),
        ].filter(isTruthy),
      },
    },
    ...tableHooks
  );

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow } = tableInstance;

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
                      <td key={key} {...otherCellProps}>
                        {cell.render('Cell', { __rowID: rowId })}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && renderExpandedRow && (
                  <tr {...otherRowProps} id={rowId} className={styles.expandedContentRow}>
                    <td colSpan={row.cells.length}>{renderExpandedRow(row.original)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {paginationEnabled && (
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
  sortIcon: css`
    position: absolute;
    top: ${theme.spacing(1)};
  `,
  headerTooltipIcon: css`
    margin-left: ${theme.spacing(0.5)};
  `,
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
