import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useRef } from 'react';
import type * as React from 'react';
import type { Observable } from 'rxjs';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data/types';
import type { FavoriteDatasources } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui/themes';

import { useKeyboardNavigatableList } from '../../hooks';

import { DataSourceCardItem } from './DataSourceCardItem';

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
};

export function VirtualizedList({
  sortedDataSources,
  enableKeyboardNavigation,
  keyboardEvents,
  current,
  favoriteDataSources,
  onChange,
  pushRecentlyUsedDataSource,
  scrollRef,
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

  return (
    <div className={styles.virtualizedContainer} style={{ height: rowVirtualizer.getTotalSize() }}>
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
