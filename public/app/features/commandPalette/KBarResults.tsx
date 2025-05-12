import { ActionImpl, getListboxItemId, KBAR_LISTBOX, useKBar } from 'kbar';
import { usePointerMovedSinceMount } from 'kbar/lib/utils';
import * as React from 'react';
import { useVirtual } from 'react-virtual';

import { URLCallback } from './types';

// From https://github.com/timc1/kbar/blob/main/src/KBarResults.tsx
// TODO: Go back to KBarResults from kbar when https://github.com/timc1/kbar/issues/281 is fixed
// Remember to remove dependency on react-virtual when removing this file

const START_INDEX = 0;

interface RenderParams<T = ActionImpl | string> {
  item: T;
  active: boolean;
}

interface KBarResultsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  onRender: (params: RenderParams) => React.ReactElement;
  maxHeight?: number;
}

export const KBarResults = (props: KBarResultsProps) => {
  const activeRef = React.useRef<HTMLElement>(null);
  const parentRef = React.useRef(null);

  // store a ref to all items so we do not have to pass
  // them as a dependency when setting up event listeners.
  const itemsRef = React.useRef(props.items);
  itemsRef.current = props.items;

  const rowVirtualizer = useVirtual({
    size: itemsRef.current.length,
    parentRef,
  });

  const { query, search, currentRootActionId, activeIndex, options } = useKBar((state) => ({
    search: state.searchQuery,
    currentRootActionId: state.currentRootActionId,
    activeIndex: state.activeIndex,
  }));

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p')) {
        event.preventDefault();
        query.setActiveIndex((index) => {
          let nextIndex = index > START_INDEX ? index - 1 : index;
          // avoid setting active index on a group
          if (typeof itemsRef.current[nextIndex] === 'string') {
            if (nextIndex === 0) {
              return index;
            }
            nextIndex -= 1;
          }
          return nextIndex;
        });
      } else if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n')) {
        event.preventDefault();
        query.setActiveIndex((index) => {
          let nextIndex = index < itemsRef.current.length - 1 ? index + 1 : index;
          // avoid setting active index on a group
          if (typeof itemsRef.current[nextIndex] === 'string') {
            if (nextIndex === itemsRef.current.length - 1) {
              return index;
            }
            nextIndex += 1;
          }
          return nextIndex;
        });
      } else if (event.key === 'Enter' && !event.metaKey) {
        event.preventDefault();
        // storing the active dom element in a ref prevents us from
        // having to calculate the current action to perform based
        // on the `activeIndex`, which we would have needed to add
        // as part of the dependencies array.
        activeRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [query]);

  // destructuring here to prevent linter warning to pass
  // entire rowVirtualizer in the dependencies array.
  const { scrollToIndex } = rowVirtualizer;
  React.useEffect(() => {
    scrollToIndex(activeIndex, {
      // ensure that if the first item in the list is a group
      // name and we are focused on the second item, to not
      // scroll past that group, hiding it.
      align: activeIndex <= 1 ? 'end' : 'auto',
    });
  }, [activeIndex, scrollToIndex]);

  React.useEffect(() => {
    // TODO(tim): fix scenario where async actions load in
    // and active index is reset to the first item. i.e. when
    // users register actions and bust the `useRegisterActions`
    // cache, we won't want to reset their active index as they
    // are navigating the list.
    query.setActiveIndex(
      // avoid setting active index on a group
      typeof props.items[START_INDEX] === 'string' ? START_INDEX + 1 : START_INDEX
    );
  }, [search, currentRootActionId, props.items, query]);

  const execute = React.useCallback(
    (ev: React.MouseEvent, item: RenderParams['item']) => {
      if (typeof item === 'string') {
        return;
      }

      // ActionImpl constructor copies all properties from action onto ActionImpl
      // so our url property is secretly there, but completely untyped
      // Preferably this change is upstreamed and ActionImpl has this
      // eslint-disable-next-line
      const url = (item as ActionImpl & { url?: string }).url;

      if (item.command) {
        item.command.perform(item);
        // TODO: ideally the perform method would return some marker or we would have something like preventDefault()
        if (!item.id.startsWith('scopes/') || item.id === 'scopes/apply') {
          query.toggle();
        }
      } else if (url) {
        if (!(ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
          query.toggle();
        }
      } else {
        query.setSearch('');
        query.setCurrentRootAction(item.id);
      }

      options.callbacks?.onSelectAction?.(item);
    },
    [query, options]
  );

  const pointerMoved = usePointerMovedSinceMount();

  return (
    <div
      ref={parentRef}
      style={{
        maxHeight: props.maxHeight || 400,
        position: 'relative',
        overflow: 'auto',
      }}
    >
      <div
        role="listbox"
        id={KBAR_LISTBOX}
        style={{
          height: `${rowVirtualizer.totalSize}px`,
          width: '100%',
        }}
      >
        {rowVirtualizer.virtualItems.map((virtualRow) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const item = itemsRef.current[virtualRow.index] as ActionImpl & {
            url?: string | URLCallback;
            target?: React.HTMLAttributeAnchorTarget;
          };

          // ActionImpl constructor copies all properties from action onto ActionImpl
          // so our url property is secretly there, but completely untyped
          // Preferably this change is upstreamed and ActionImpl has this
          const { target, url } = item;

          const handlers = typeof item !== 'string' && {
            onPointerMove: () =>
              pointerMoved && activeIndex !== virtualRow.index && query.setActiveIndex(virtualRow.index),
            onPointerDown: () => query.setActiveIndex(virtualRow.index),
            onClick: (ev: React.MouseEvent) => execute(ev, item),
          };
          const active = virtualRow.index === activeIndex;

          const childProps = {
            id: getListboxItemId(virtualRow.index),
            role: 'option',
            'aria-selected': active,
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            } as const,
            ...handlers,
          };

          const renderedItem = React.cloneElement(
            props.onRender({
              item,
              active,
            }),
            {
              ref: virtualRow.measureRef,
            }
          );

          if (url) {
            return (
              <a
                key={virtualRow.index}
                href={typeof url === 'function' ? url(search) : url}
                target={target}
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                ref={active ? (activeRef as React.RefObject<HTMLAnchorElement>) : null}
                {...childProps}
              >
                {renderedItem}
              </a>
            );
          }

          return (
            <div
              key={virtualRow.index}
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              ref={active ? (activeRef as React.RefObject<HTMLDivElement>) : null}
              {...childProps}
            >
              {renderedItem}
            </div>
          );
        })}
      </div>
    </div>
  );
};
