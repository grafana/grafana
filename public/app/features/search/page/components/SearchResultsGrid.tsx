import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useObservable } from 'react-use';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { of } from 'rxjs';

import { Field, GrafanaTheme2, locationUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { SearchCard } from '../../components/SearchCard';
import { DashboardSearchItemType, DashboardSectionItem } from '../../types';

import { SearchResultsProps } from './SearchResultsTable';

interface ItemSelection {
  x: number;
  y: number;
}

export const SearchResultsGrid = ({
  response,
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  keyboardEvents,
}: SearchResultsProps) => {
  const styles = useStyles2(getStyles);

  const highlightIndexRef = useRef<ItemSelection>({ x: 0, y: -1 });
  const [highlightIndex, setHighlightIndex] = useState<ItemSelection>({ x: 0, y: 0 });
  const urlsRef = useRef<Field>();

  // Scroll to the top and clear loader cache when the query results change
  useEffect(() => {
    urlsRef.current = response.view.fields.url;
  }, [response]);

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

  const keyEvent = useObservable(keyboardEvents ?? of());
  useEffect(() => {
    switch (keyEvent?.code) {
      case 'ArrowDown': {
        highlightIndexRef.current.y++;
        setHighlightIndex({
          y: highlightIndexRef.current.y,
          x: highlightIndexRef.current.x,
        });
        break;
      }
      case 'ArrowUp':
        highlightIndexRef.current.y = Math.max(0, highlightIndexRef.current.y - 1);
        setHighlightIndex({
          y: highlightIndexRef.current.y,
          x: highlightIndexRef.current.x,
        });
        break;
      case 'ArrowRight': {
        highlightIndexRef.current.x = Math.min(numColumns, highlightIndexRef.current.x + 1);
        setHighlightIndex({
          y: highlightIndexRef.current.y,
          x: highlightIndexRef.current.x,
        });
        break;
      }
      case 'ArrowLeft': {
        highlightIndexRef.current.x = Math.max(0, highlightIndexRef.current.x - 1);
        setHighlightIndex({
          y: highlightIndexRef.current.y,
          x: highlightIndexRef.current.x,
        });
        break;
      }
      case 'Enter':
        if (highlightIndexRef.current.y >= 0 && urlsRef.current) {
          const idx = highlightIndexRef.current.x * numColumns + highlightIndexRef.current.y;
          const url = urlsRef.current.values?.get(idx) as string;
          if (url) {
            locationService.push(locationUtil.stripBaseFromUrl(url));
          }
        }
    }
  }, [keyEvent, numColumns]);

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
    box-shadow: inset 1px 1px 6px 6px ${theme.colors.primary.border};
  `,
});
