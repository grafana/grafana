import { css } from '@emotion/css';
import React from 'react';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { SearchCard } from '../../components/SearchCard';
import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { DashboardSearchItemType, DashboardSectionItem } from '../../types';

import { SearchResultsProps } from './SearchResultsTable';

export const SearchResultsGrid = ({
  response,
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  onClickItem,
  keyboardEvents,
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
    onClick: onClickItem,
  };

  const itemCount = response.totalRows ?? response.view.length;
  const view = response.view;
  const numColumns = Math.ceil(width / 320);
  const cellWidth = width / numColumns;
  const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
  const numRows = Math.ceil(itemCount / numColumns);
  const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, numColumns, response);

  return (
    <InfiniteLoader isItemLoaded={response.isItemLoaded} itemCount={itemCount} loadMoreItems={response.loadMoreItems}>
      {({ onItemsRendered, ref }) => (
        <FixedSizeGrid
          ref={ref}
          onItemsRendered={(v) => {
            onItemsRendered({
              visibleStartIndex: v.visibleRowStartIndex * numColumns,
              visibleStopIndex: v.visibleRowStopIndex * numColumns,
              overscanStartIndex: v.overscanRowStartIndex * numColumns,
              overscanStopIndex: v.overscanColumnStopIndex * numColumns,
            });
          }}
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

            if (kind === 'panel') {
              const type = item.panel_type;
              facade.icon = 'public/img/icons/unicons/graph-bar.svg';
              if (type) {
                const info = config.panels[type];
                if (info?.name) {
                  const v = info.info?.logos.small;
                  if (v && v.endsWith('.svg')) {
                    facade.icon = v;
                  }
                }
              }
            }

            let className = styles.virtualizedGridItemWrapper;
            if (rowIndex === highlightIndex.y && columnIndex === highlightIndex.x) {
              className += ' ' + styles.selectedItem;
            }

            // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
            // And without this wrapper there is no room for that margin
            return item ? (
              <li style={style} className={className}>
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
  selectedItem: css`
    box-shadow: inset 1px 1px 3px 3px ${theme.colors.primary.border};
  `,
});
