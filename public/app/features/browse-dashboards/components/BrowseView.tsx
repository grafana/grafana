import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTable, Column, TableInstance, CellProps } from 'react-table';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, IconButton, Link } from '@grafana/ui';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

type NestedData = Record<string, DashboardViewItem[] | undefined>;

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

interface FlatNestedTreeItem {
  item: DashboardViewItem;
  level: number;
  isOpen: boolean;
}

const HEADER_HEIGHT = 35;
const ITEM_HEIGHT = 35;

export function BrowseView({ folderUID, width, height }: BrowseViewProps) {
  const styles = useStyles2(getStyles);

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
      Header: () => <input type="checkbox" />,
      Cell: () => <input type="checkbox" />,
    };

    const nameColumn: Column<FlatNestedTreeItem> = {
      id: 'name',
      accessor: (row) => row,
      Header: 'Name',
      Cell: (props: CellProps<FlatNestedTreeItem, unknown>) => (
        <NameCell {...props} onFolderClick={handleFolderClick} />
      ),
    };

    const typeColumn: Column<FlatNestedTreeItem> = {
      id: 'type',
      accessor: (row) => row.item.kind,
      Header: 'Type',
    };

    return [checkboxColumn, nameColumn, typeColumn];
  }, [handleFolderClick]);

  const tableInstance = useTable({ columns: tableColumns, data: flatTree });

  const { getTableProps, getTableBodyProps, headerGroups } = tableInstance;

  const virtualData = useMemo(() => {
    return {
      items: flatTree,
      tableInstance,
      onFolderClick: handleFolderClick,
    };
  }, [flatTree, tableInstance, handleFolderClick]);

  return (
    <div {...getTableProps()} role="table">
      {headerGroups.map((headerGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps({
          style: { width },
        });

        return (
          <div key={key} {...headerGroupProps} className={styles.headerRow}>
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
          itemCount={flatTree.length}
          itemData={virtualData}
          itemSize={ITEM_HEIGHT}
        >
          {Row}
        </List>
      </div>
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
  const { rows, prepareRow } = data.tableInstance;

  const row = rows[index];
  prepareRow(row);

  return (
    <div {...row.getRowProps({ style })} className={styles.rowContainer}>
      {row.cells.map((cell) => {
        const { key, ...cellProps } = cell.getCellProps();

        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {cell.render('Cell')}
          </div>
        );
      })}
    </div>
  );
};

type NameCellProps = CellProps<FlatNestedTreeItem, unknown> & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

function NameCell({ row: { original: data }, onFolderClick }: NameCellProps) {
  const { item, level, isOpen } = data;

  return (
    <span style={{ paddingLeft: level * 24 }}>
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
  return {
    cell: css({
      padding: theme.spacing(1),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),

    headerRow: css({
      label: 'header-row',
      display: 'grid',
      gridTemplateColumns: 'auto 2fr 1fr',
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    rowContainer: css({
      display: 'grid',
      gridTemplateColumns: 'auto 2fr 1fr',

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),
  };
};
