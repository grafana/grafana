import { css } from '@emotion/css';
import React from 'react';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SearchCard } from '../../components/SearchCard';
import { DashboardSearchItemType, DashboardSectionItem } from '../../types';

import { SearchResultsProps } from './SearchResultsTable';

export const SearchResultsGrid = ({
  response,
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  onDatasourceChange,
}: SearchResultsProps) => {
  const styles = useStyles2(getStyles);

  // Hacked to reuse existing SearchCard (and old DashboardSectionItem)
  const itemProps = {
    editable: selection != null,
    onToggleChecked: (item: any) => {
      const d = item as DashboardSectionItem;
      const t = d.type === DashboardSearchItemType.DashFolder ? 'folder' : 'dashboard';
      if (selectionToggle) {
        selectionToggle(t, d.uid!);
      }
    },
    onTagSelected,
  };

  const itemCount = response.totalRows ?? response.view.length;

  const view = response.view;
  const numColumns = Math.ceil(width / 320);
  const cellWidth = width / numColumns;
  const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
  const numRows = Math.ceil(itemCount / numColumns);
  return (
    <InfiniteLoader isItemLoaded={response.isItemLoaded} itemCount={itemCount} loadMoreItems={response.loadMoreItems}>
      {({ onItemsRendered, ref }) => (
        <FixedSizeGrid
          columnCount={numColumns}
          columnWidth={cellWidth}
          rowCount={numRows}
          rowHeight={cellHeight}
          className={styles.wrapper}
          innerElementType="ul"
          height={height}
          width={width - 2}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * numColumns + columnIndex;
            if (index >= view.length) {
              return null;
            }

            const item = view.get(index);
            const kind = item.kind ?? 'dashboard';
            const facade: DashboardSectionItem = {
              uid: item.uid,
              title: item.name,
              url: item.url,
              uri: item.url,
              type: kind === 'folder' ? DashboardSearchItemType.DashFolder : DashboardSearchItemType.DashDB,
              id: 666, // do not use me!
              isStarred: false,
              tags: item.tags ?? [],
              checked: selection ? selection(kind, item.uid) : false,
            };

            // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
            // And without this wrapper there is no room for that margin
            return item ? (
              <li style={style} className={styles.virtualizedGridItemWrapper}>
                <SearchCard key={item.uid} {...itemProps} item={facade} />
              </li>
            ) : null;
          }}
        </FixedSizeGrid>
      )}
    </InfiniteLoader>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  virtualizedGridItemWrapper: css`
    padding: 4px;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;

    > ul {
      list-style: none;
    }
  `,
});
