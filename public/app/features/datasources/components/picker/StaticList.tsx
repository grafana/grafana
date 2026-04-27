import { useCallback } from 'react';
import type * as React from 'react';
import type { Observable } from 'rxjs';

import type { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data/types';
import type { FavoriteDatasources } from '@grafana/runtime';

import { useKeyboardNavigatableList } from '../../hooks';

import { DataSourceCardItem } from './DataSourceCardItem';

export type StaticListProps = {
  sortedDataSources: DataSourceInstanceSettings[];
  enableKeyboardNavigation?: boolean;
  keyboardEvents?: Observable<React.KeyboardEvent>;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  favoriteDataSources: FavoriteDatasources;
  onChange: (ds: DataSourceInstanceSettings) => void;
  pushRecentlyUsedDataSource: (ds: DataSourceInstanceSettings) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export function StaticList({
  sortedDataSources,
  enableKeyboardNavigation,
  keyboardEvents,
  current,
  favoriteDataSources,
  onChange,
  pushRecentlyUsedDataSource,
  scrollRef,
}: StaticListProps) {
  const stableScrollToIndex = useCallback(
    (index: number) => {
      const container = scrollRef.current;
      if (container) {
        const items = container.querySelectorAll('[data-testid="data-source-card"]');
        items[index]?.scrollIntoView({ block: 'nearest' });
      }
    },
    [scrollRef]
  );

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
    <>
      {sortedDataSources.map((ds, index) => (
        <DataSourceCardItem
          key={ds.uid}
          ds={ds}
          isSelected={!!enableKeyboardNavigation && index === selectedIndex}
          enableKeyboardNavigation={enableKeyboardNavigation}
          current={current}
          favoriteDataSources={favoriteDataSources}
          onChange={onChange}
          pushRecentlyUsedDataSource={pushRecentlyUsedDataSource}
        />
      ))}
    </>
  );
}
