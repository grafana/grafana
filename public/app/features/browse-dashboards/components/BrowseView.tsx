/* eslint-disable react/jsx-key */
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTable, Column, TableInstance, useAbsoluteLayout, CellProps } from 'react-table';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, IconButton, Link } from '@grafana/ui';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

type NestedData = Record<string, DashboardViewItem[] | undefined>;

interface BrowseViewProps {
  folderUID: string | undefined;
}

interface FlatNestedTreeItem {
  item: DashboardViewItem;
  level: number;
  isOpen: boolean;
}

const HEADER_HEIGHT = 35;
const ITEM_HEIGHT = 35;

export function BrowseView({ folderUID }: BrowseViewProps) {
  const styles = useStyles2(getStyles);
  // const columnStyles = useStyles2(getColumnStyles);
  // const tableStyles = useTableStyles(useTheme2(), TableCellHeight.Sm);

  const [openFolders, setOpenFolders] = useState<string[]>([]);

  const [nestedData, setNestedData] = useState<NestedData>({});

  // Note: entire implementation of this component must be replaced.
  // This is just to show proof of concept for fetching and showing the data

  useEffect(() => {
    function loadChildrenForUID(uid: string | undefined) {
      const folderKey = uid ?? '$$root';

      return getFolderChildren(uid, undefined, true).then((children) => {
        setNestedData((v) => ({ ...v, [folderKey]: children }));
      });
    }

    loadChildrenForUID(folderUID);
  }, [folderUID]);

  const flatTree = useMemo(() => {
    function mapItems(items: DashboardViewItem[], level = 0): FlatNestedTreeItem[] {
      return items.flatMap((item) => {
        const isOpen = openFolders.includes(item.uid);
        const rawChildren = (isOpen && nestedData[item.uid]) || [];
        const mappedChildren = mapItems(rawChildren, level + 1);

        const thisItem = {
          item,
          level,
          isOpen,
        };

        return [thisItem, ...mappedChildren];
      });
    }

    const items = nestedData[folderUID ?? '$$root'] ?? [];

    const mappedItems = mapItems(items);
    return mappedItems;
  }, [openFolders, nestedData, folderUID]);

  const handleFolderClick = useCallback((uid: string, newState: boolean) => {
    if (newState) {
      getFolderChildren(uid).then((children) => {
        setNestedData((v) => ({ ...v, [uid]: children }));
      });
    }

    setOpenFolders((v) => {
      if (newState) {
        return [...v, uid];
      } else {
        return v.filter((v) => v !== uid);
      }
    });
  }, []);

  const tableColumns = useMemo(() => {
    const checkboxColumn: Column<FlatNestedTreeItem> = {
      id: 'checkbox',
      width: 30,
      Header: () => <input type="checkbox" />,
      Cell: () => <input type="checkbox" />,
    };

    const nameColumn: Column<FlatNestedTreeItem> = {
      id: 'name',
      width: 500,
      accessor: (row) => row,
      Header: () => <span>Name</span>,
      Cell: (
        { value }: CellProps<FlatNestedTreeItem, FlatNestedTreeItem> // TODO: generic args aren't type checked
      ) => <BrowseItem item={value.item} isOpen={value.isOpen} level={value.level} onFolderClick={handleFolderClick} />,
    };

    const typeColumn: Column<FlatNestedTreeItem> = {
      id: 'type',
      width: 300,
      accessor: (row) => row.item.kind,
      Header: () => <span>Name</span>,
    };

    return [checkboxColumn, nameColumn, typeColumn];
  }, [handleFolderClick]);

  const tableInstance = useTable({ columns: tableColumns, data: flatTree }, useAbsoluteLayout);
  const { getTableProps, getTableBodyProps, headerGroups } = tableInstance;

  const virtualData = useMemo(() => {
    return {
      items: flatTree,
      tableInstance,
      onFolderClick: handleFolderClick,
    };
  }, [flatTree, tableInstance, handleFolderClick]);

  const onItemsRendered = useCallback((args) => {
    console.log('onItemsRendered', args);
  }, []);

  return (
    <div style={{ height: '100%' }}>
      <AutoSizer>
        {({ width, height }) => (
          <div {...getTableProps()} role="table">
            <div>
              {headerGroups.map((headerGroup) => {
                const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();

                return (
                  <div key={key} {...headerGroupProps} className={styles.headerRow}>
                    {headerGroup.headers.map((column) => {
                      const { key, ...headerProps } = column.getHeaderProps();
                      return (
                        <div key={key} {...headerProps} role="columnheader" className={styles.headerCell}>
                          {column.render('Header')}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div {...getTableBodyProps()}>
              <List
                onItemsRendered={onItemsRendered}
                height={height - HEADER_HEIGHT}
                width={width}
                itemCount={flatTree.length}
                itemData={virtualData}
                itemSize={ITEM_HEIGHT}
              >
                {Row}
              </List>
            </div>
          </div>
        )}
      </AutoSizer>
    </div>
  );
}

interface VirtualData {
  items: FlatNestedTreeItem[];
  tableInstance: TableInstance<FlatNestedTreeItem>;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}

const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: VirtualData }) => {
  const styles = useStyles2(getStyles);
  // const { item, isOpen, level } = data.items[index];
  const { rows, prepareRow } = data.tableInstance;

  const row = rows[index];
  prepareRow(row);

  return (
    <div {...row.getRowProps({ style })} className={styles.rowContainer}>
      {row.cells.map((cell) => {
        return (
          <div {...cell.getCellProps()} className={styles.headerCell}>
            {cell.render('Cell')}
          </div>
        );
      })}
    </div>
  );
};

function BrowseItem({
  item,
  level,
  isOpen,
  onFolderClick,
}: {
  item: DashboardViewItem;
  level: number;
  isOpen?: boolean;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}) {
  return (
    <span style={{ paddingLeft: level * 16 }}>
      {item.kind === 'folder' ? (
        <IconButton onClick={() => onFolderClick(item.uid, !isOpen)} name={isOpen ? 'angle-down' : 'angle-right'} />
      ) : (
        <span style={{ paddingRight: 20 }} />
      )}
      <Icon name={item.kind === 'folder' ? (isOpen ? 'folder-open' : 'folder') : 'apps'} />{' '}
      <Link href={item.kind === 'folder' ? `/nested-dashboards/f/${item.uid}` : `/d/${item.uid}`}>{item.title}</Link>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    noData: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    `,
    headerCell: css`
      padding: ${theme.spacing(1)};
    `,
    headerRow: css`
      background-color: ${theme.colors.background.secondary};
      height: ${HEADER_HEIGHT}px;
      align-items: center;
    `,
    selectedRow: css`
      background-color: ${rowHoverBg};
      box-shadow: inset 3px 0px ${theme.colors.primary.border};
    `,
    rowContainer: css`
      label: row;
      &:hover {
        background-color: ${rowHoverBg};
      }

      &:not(:hover) div[role='cell'] {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  };
};
