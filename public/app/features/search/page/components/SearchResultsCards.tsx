/* eslint-disable react/jsx-no-undef */
import { css } from '@emotion/css';
import React, { useEffect, useRef, useCallback, useState, CSSProperties } from 'react';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SearchItem } from '../../components/SearchItem';
import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { queryResultToViewItem } from '../../service/utils';

import { SearchResultsProps } from './SearchResultsTable';

export const SearchResultsCards = React.memo(
  ({
    response,
    width,
    height,
    selection,
    selectionToggle,
    onTagSelected,
    keyboardEvents,
    onClickItem,
  }: SearchResultsProps) => {
    const styles = useStyles2(getStyles);
    const infiniteLoaderRef = useRef<InfiniteLoader>(null);
    const [listEl, setListEl] = useState<FixedSizeList | null>(null);
    const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, 0, response);

    // Scroll to the top and clear loader cache when the query results change
    useEffect(() => {
      if (infiniteLoaderRef.current) {
        infiniteLoaderRef.current.resetloadMoreItemsCache();
      }
      if (listEl) {
        listEl.scrollTo(0);
      }
    }, [response, listEl]);

    const RenderRow = useCallback(
      ({ index: rowIndex, style }: { index: number; style: CSSProperties }) => {
        let className = '';
        if (rowIndex === highlightIndex.y) {
          className += ' ' + styles.selectedRow;
        }

        const item = response.view.get(rowIndex);
        const searchItem = queryResultToViewItem(item, response.view);

        return (
          <div style={style} key={item.uid} className={className} role="row">
            <SearchItem
              item={searchItem}
              onTagSelected={onTagSelected}
              onToggleChecked={(item) => {
                if (selectionToggle) {
                  selectionToggle('dashboard', item.uid!);
                }
              }}
              editable={Boolean(selection != null)}
              onClickItem={onClickItem}
              isSelected={selectionToggle && selection?.(searchItem.kind, searchItem.uid)}
            />
          </div>
        );
      },
      [response.view, highlightIndex, styles, onTagSelected, selection, selectionToggle, onClickItem]
    );

    if (!response.totalRows) {
      return (
        <div className={styles.noData} style={{ width }}>
          No data
        </div>
      );
    }

    return (
      <div aria-label="Search results list" style={{ width }} role="list">
        <InfiniteLoader
          ref={infiniteLoaderRef}
          isItemLoaded={response.isItemLoaded}
          itemCount={response.totalRows}
          loadMoreItems={response.loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <FixedSizeList
              ref={(innerRef) => {
                ref(innerRef);
                setListEl(innerRef);
              }}
              onItemsRendered={onItemsRendered}
              height={height}
              itemCount={response.totalRows}
              itemSize={72}
              width="100%"
              style={{ overflow: 'hidden auto' }}
            >
              {RenderRow}
            </FixedSizeList>
          )}
        </InfiniteLoader>
      </div>
    );
  }
);
SearchResultsCards.displayName = 'SearchResultsCards';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    noData: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    `,
    selectedRow: css`
      border-left: 3px solid ${theme.colors.primary.border};
    `,
  };
};
