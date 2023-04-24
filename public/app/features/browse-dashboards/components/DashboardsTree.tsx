import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { CellProps, Column, TableInstance, useTable } from 'react-table';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Checkbox, useStyles2 } from '@grafana/ui';
import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

import { DashboardsTreeItem, DashboardTreeSelection, INDENT_AMOUNT_CSS_VAR } from '../types';

import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { TypeCell } from './TypeCell';
import { useCustomFlexLayout } from './customFlexTableLayout';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  selectedItems: DashboardTreeSelection;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onItemSelectionChange: (item: DashboardViewItem, newState: boolean) => void;
}

type DashboardsTreeColumn = Column<DashboardsTreeItem>;
type DashboardsTreeCellProps = CellProps<DashboardsTreeItem, unknown> & {
  // Note: userProps for cell renderers (e.g. second argument in `cell.render('Cell', foo)` )
  // aren't typed, so we must be careful when accessing this
  selectedItems?: DashboardsTreeProps['selectedItems'];
};

const HEADER_HEIGHT = 35;
const ROW_HEIGHT = 35;

export function DashboardsTree({
  items,
  width,
  height,
  selectedItems,
  onFolderClick,
  onItemSelectionChange,
}: DashboardsTreeProps) {
  const styles = useStyles2(getStyles);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      width: 0,
      Header: () => <Checkbox value={false} />,
      Cell: ({ row: { original: row }, selectedItems }: DashboardsTreeCellProps) => {
        const item = row.item;
        if (item.kind === 'ui-empty-folder' || !selectedItems) {
          return <></>;
        }

        const isSelected = selectedItems?.[item.kind][item.uid] ?? false;
        return (
          <Checkbox
            data-testid={selectors.pages.BrowseDashbards.table.checkbox(item.uid)}
            value={isSelected}
            onChange={(ev) => onItemSelectionChange(item, ev.currentTarget.checked)}
          />
        );
      },
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

    return [checkboxColumn, nameColumn, typeColumn, tagsColumns];
  }, [onItemSelectionChange, onFolderClick]);

  const table = useTable({ columns: tableColumns, data: items }, useCustomFlexLayout);
  const { getTableProps, getTableBodyProps, headerGroups } = table;

  const virtualData = useMemo(() => {
    return {
      table,
      selectedItems,
    };
  }, [table, selectedItems]);

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
                  {column.render('Header')}
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
    selectedItems: Record<DashboardViewItemKind, Record<string, boolean | undefined>>;
  };
}

function VirtualListRow({ index, style, data }: VirtualListRowProps) {
  const styles = useStyles2(getStyles);
  const { table, selectedItems } = data;
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
            {cell.render('Cell', { selectedItems })}
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
