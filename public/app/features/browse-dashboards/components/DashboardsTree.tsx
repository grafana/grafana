import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { TableInstance, useTable } from 'react-table';
import { FixedSizeList as List, ListOnItemsRenderedProps, ListOnScrollProps } from 'react-window';

import { GrafanaTheme2, isTruthy } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { DashboardViewItem } from 'app/features/search/types';

import {
  DashboardsTreeCellProps,
  DashboardsTreeColumn,
  DashboardsTreeItem,
  INDENT_AMOUNT_CSS_VAR,
  SelectionState,
} from '../types';

import CheckboxCell from './CheckboxCell';
import CheckboxHeaderCell from './CheckboxHeaderCell';
import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { TypeCell } from './TypeCell';
import { useCustomFlexLayout } from './customFlexTableLayout';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  isSelected: (kind: DashboardViewItem | '$all') => SelectionState;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onAllSelectionChange: (newState: boolean) => void;
  onItemSelectionChange: (item: DashboardViewItem, newState: boolean) => void;
  onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
  canSelect: boolean;
}

const HEADER_HEIGHT = 35;
const ROW_HEIGHT = 35;

export function DashboardsTree({
  items,
  width,
  height,
  isSelected,
  onFolderClick,
  onAllSelectionChange,
  onItemSelectionChange,
  onItemsRendered,
  canSelect = false,
}: DashboardsTreeProps) {
  const styles = useStyles2(getStyles);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      width: 0,
      Header: CheckboxHeaderCell,
      Cell: CheckboxCell,
    };

    const nameColumn: DashboardsTreeColumn = {
      id: 'name',
      width: 3,
      Header: <span style={{ paddingLeft: 20 }}>Name</span>,
      Cell: (props: DashboardsTreeCellProps) => <NameCell {...props} onFolderClick={onFolderClick} />,
    };

    const typeColumn: DashboardsTreeColumn = {
      id: 'type',
      width: 1,
      Header: 'Type',
      Cell: TypeCell,
    };

    const tagsColumns: DashboardsTreeColumn = {
      id: 'tags',
      width: 2,
      Header: 'Tags',
      Cell: TagsCell,
    };
    const columns = [canSelect && checkboxColumn, nameColumn, typeColumn, tagsColumns].filter(isTruthy);

    return columns;
  }, [onFolderClick, canSelect]);

  const table = useTable({ columns: tableColumns, data: items }, useCustomFlexLayout);
  const { getTableProps, getTableBodyProps, headerGroups } = table;

  const virtualData = useMemo(
    () => ({
      table,
      isSelected,
      onAllSelectionChange,
      onItemSelectionChange,
    }),
    // we need this to rerender if items changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, isSelected, onAllSelectionChange, onItemSelectionChange, items]
  );

  const handleScroll = useCallback((props: ListOnScrollProps) => {
    // console.log('handleScroll', props);
  }, []);

  const handleItemsRendered = useCallback(
    (props: ListOnItemsRenderedProps) => {
      // console.log('handleItemsRendered', props);
      onItemsRendered?.(props);
    },
    [onItemsRendered]
  );

  return (
    <div {...getTableProps()} className={styles.tableRoot} role="table">
      {headerGroups.map((headerGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps({
          style: { width },
        });

        return (
          <div key={key} {...headerGroupProps} className={cx(styles.row, styles.headerRow)}>
            {headerGroup.headers.map((column) => {
              const { key, ...headerProps } = column.getHeaderProps();

              return (
                <div key={key} {...headerProps} role="columnheader" className={styles.cell}>
                  {column.render('Header', { isSelected, onAllSelectionChange })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div {...getTableBodyProps()}>
        <List
          height={height - HEADER_HEIGHT}
          width={width}
          itemCount={items.length}
          itemData={virtualData}
          itemSize={ROW_HEIGHT}
          onScroll={handleScroll}
          onItemsRendered={handleItemsRendered}
        >
          {VirtualListRow}
        </List>
      </div>
    </div>
  );
}

interface VirtualListRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    table: TableInstance<DashboardsTreeItem>;
    isSelected: DashboardsTreeCellProps['isSelected'];
    onAllSelectionChange: DashboardsTreeCellProps['onAllSelectionChange'];
    onItemSelectionChange: DashboardsTreeCellProps['onItemSelectionChange'];
  };
}

function VirtualListRow({ index, style, data }: VirtualListRowProps) {
  const styles = useStyles2(getStyles);
  const { table, isSelected, onItemSelectionChange } = data;
  const { rows, prepareRow } = table;

  const row = rows[index];
  prepareRow(row);

  return (
    <div
      {...row.getRowProps({ style })}
      className={cx(styles.row, styles.bodyRow)}
      data-testid={selectors.pages.BrowseDashbards.table.row(row.original.item.uid)}
    >
      {row.cells.map((cell) => {
        const { key, ...cellProps } = cell.getCellProps();

        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {cell.render('Cell', { isSelected, onItemSelectionChange })}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableRoot: css({
      // Responsively
      [INDENT_AMOUNT_CSS_VAR]: theme.spacing(1),

      [theme.breakpoints.up('md')]: {
        [INDENT_AMOUNT_CSS_VAR]: theme.spacing(3),
      },
    }),

    // Column flex properties (cell sizing) are set by customFlexTableLayout.ts

    row: css({
      gap: theme.spacing(1),
    }),

    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    bodyRow: css({
      height: ROW_HEIGHT,

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),

    cell: css({
      padding: theme.spacing(1),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),

    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
