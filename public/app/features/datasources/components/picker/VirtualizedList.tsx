import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef } from 'react';
import type * as React from 'react';
import type { Observable } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import type { FavoriteDatasources } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { useKeyboardNavigatableList } from '../../hooks';

import { DataSourceCardItem } from './DataSourceCardItem';
import { isDataSourceMatch } from './utils';

const VIRTUAL_OVERSCAN_ITEMS = 4;
const ESTIMATED_ITEM_HEIGHT = 48;

export type VirtualizedListProps = {
  sortedDataSources: DataSourceInstanceSettings[];
  enableKeyboardNavigation?: boolean;
  keyboardEvents?: Observable<React.KeyboardEvent>;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  favoriteDataSources: FavoriteDatasources;
  onChange: (ds: DataSourceInstanceSettings) => void;
  pushRecentlyUsedDataSource: (ds: DataSourceInstanceSettings) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** DOM id of the listbox, used to build option ids for aria-activedescendant */
  listboxId?: string;
  /** Reports the DOM id of the keyboard-highlighted option, for aria-activedescendant on the input */
  onActiveItemChange?: (id: string | undefined) => void;
};

const optionId = (listboxId: string, uid: string) => `${listboxId}-${uid}`;

export function VirtualizedList({
  sortedDataSources,
  enableKeyboardNavigation,
  keyboardEvents,
  current,
  favoriteDataSources,
  onChange,
  pushRecentlyUsedDataSource,
  scrollRef,
  listboxId,
  onActiveItemChange,
}: VirtualizedListProps) {
  const styles = useStyles2(getStyles);

  const rowVirtualizer = useVirtualizer({
    count: sortedDataSources.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: VIRTUAL_OVERSCAN_ITEMS,
  });

  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  const stableScrollToIndex = useCallback((index: number) => {
    virtualizerRef.current?.scrollToIndex(index, { align: 'auto' });
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      const ds = sortedDataSources[index];
      if (ds) {
        pushRecentlyUsedDataSource(ds);
        onChange(ds);
      }
    },
    [sortedDataSources, onChange, pushRecentlyUsedDataSource]
  );

  const selectedIndex = useKeyboardNavigatableList({
    keyboardEvents: enableKeyboardNavigation ? keyboardEvents : undefined,
    itemCount: sortedDataSources.length,
    scrollToIndex: stableScrollToIndex,
    onSelect: handleSelect,
  });

  useEffect(() => {
    const ds = sortedDataSources[selectedIndex];
    onActiveItemChange?.(listboxId && ds ? optionId(listboxId, ds.uid) : undefined);
    // Clean up so aria-activedescendant never references a removed option
    return () => onActiveItemChange?.(undefined);
  }, [listboxId, onActiveItemChange, selectedIndex, sortedDataSources]);

  return (
    <div
      className={styles.virtualizedContainer}
      style={{ height: rowVirtualizer.getTotalSize() }}
      {...(enableKeyboardNavigation && { role: 'listbox', id: listboxId })}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const ds = sortedDataSources[virtualRow.index];
        return (
          <div
            key={ds.uid}
            className={styles.virtualizedItem}
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            {...(enableKeyboardNavigation && {
              id: listboxId ? optionId(listboxId, ds.uid) : undefined,
              role: 'option',
              'aria-selected': isDataSourceMatch(ds, current),
              'aria-label': ds.name,
              // explicit position/size, since virtualization means only visible rows exist in the DOM
              'aria-posinset': virtualRow.index + 1,
              'aria-setsize': sortedDataSources.length,
              // the option itself handles the click
              onClick: () => handleSelect(virtualRow.index),
            })}
          >
            <DataSourceCardItem
              ds={ds}
              isSelected={!!enableKeyboardNavigation && virtualRow.index === selectedIndex}
              enableKeyboardNavigation={enableKeyboardNavigation}
              current={current}
              favoriteDataSources={favoriteDataSources}
              onChange={onChange}
              pushRecentlyUsedDataSource={pushRecentlyUsedDataSource}
            />
          </div>
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    virtualizedContainer: css({
      width: '100%',
      position: 'relative',
    }),
    virtualizedItem: css({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
    }),
  };
}
