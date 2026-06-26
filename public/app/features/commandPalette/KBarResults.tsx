import { type ActionImpl, getListboxItemId, KBAR_LISTBOX, useKBar } from 'kbar';
import { usePointerMovedSinceMount } from 'kbar/lib/utils';
import * as React from 'react';
import { useVirtual } from 'react-virtual';

import { type URLCallback } from './types';

// From https://github.com/timc1/kbar/blob/main/src/KBarResults.tsx
// TODO: Go back to KBarResults from kbar when https://github.com/timc1/kbar/issues/281 is fixed
// Remember to remove dependency on react-virtual when removing this file

interface RenderParams<T = ActionImpl | string> {
  item: T;
  active: boolean;
}

interface KBarResultsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  onRender: (params: RenderParams) => React.ReactElement<Record<string, unknown>>;
  maxHeight?: number;
  /** The scroll container, focusable so keyboard navigation can target the list. */
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  /**
   * Called when an item is selected (click or keyboard Enter, which dispatches a
   * click on the row). Receives the raw index into `items`, for analytics.
   */
  onItemSelected?: (item: ActionImpl, index: number) => void;
}

export const KBarResults = (props: KBarResultsProps) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null);

  // store a ref to all items so we do not have to pass
  // them as a dependency when setting up event listeners.
  const itemsRef = React.useRef(props.items);
  itemsRef.current = props.items;

  // A11y: Pre-compute the group label for each item so that option items can
  // announce their section even when the section header has scrolled out of
  // the virtual window and is no longer in the DOM.
  const itemGroupLabels = React.useMemo(() => {
    const labels: Array<string | null> = [];
    let currentGroup: string | null = null;
    for (const item of props.items) {
      if (typeof item === 'string') {
        currentGroup = item;
      }
      labels.push(currentGroup);
    }
    return labels;
  }, [props.items]);

  const rowVirtualizer = useVirtual({
    size: itemsRef.current.length,
    parentRef,
  });

  const { query, search, currentRootActionId, activeIndex, options } = useKBar((state) => ({
    search: state.searchQuery,
    currentRootActionId: state.currentRootActionId,
    activeIndex: state.activeIndex,
  }));

  // Arrow/Enter/Escape key handling lives in the palette-wide navigation
  // handler (RenderResults) — it owns moving the highlight between the search
  // input, this list and the deep search column.

  // destructuring here to prevent linter warning to pass
  // entire rowVirtualizer in the dependencies array.
  const { scrollToIndex } = rowVirtualizer;
  React.useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    scrollToIndex(activeIndex, {
      // ensure that if the first item in the list is a group
      // name and we are focused on the second item, to not
      // scroll past that group, hiding it.
      align: activeIndex <= 1 ? 'end' : 'auto',
    });
  }, [activeIndex, scrollToIndex]);

  React.useEffect(() => {
    // Nothing is preselected — the highlight appears once keyboard navigation
    // enters the list (or on pointer hover)
    query.setActiveIndex(-1);
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
        if (url) {
          // If the item also has a url we should block navigation.
          ev.preventDefault();
        }
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
      ref={(element) => {
        parentRef.current = element;
        if (props.scrollRef) {
          props.scrollRef.current = element;
        }
      }}
      tabIndex={-1}
      data-testid="command-palette-keyword-results"
      style={{
        maxHeight: props.maxHeight || 400,
        position: 'relative',
        overflow: 'auto',
        outline: 'none',
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
          const rawItem = itemsRef.current[virtualRow.index];
          const isStringItem = typeof rawItem === 'string';

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const item = rawItem as ActionImpl & {
            url?: string | URLCallback;
            target?: React.HTMLAttributeAnchorTarget;
          };

          // ActionImpl constructor copies all properties from action onto ActionImpl
          // so our url property is secretly there, but completely untyped
          // Preferably this change is upstreamed and ActionImpl has this
          const { target, url } = item;
          const groupLabel = itemGroupLabels[virtualRow.index];

          const handlers = !isStringItem && {
            onPointerMove: () =>
              pointerMoved && activeIndex !== virtualRow.index && query.setActiveIndex(virtualRow.index),
            onPointerDown: () => query.setActiveIndex(virtualRow.index),
            onClick: (ev: React.MouseEvent) => {
              // Report before perform, since perform may close the palette / navigate away
              props.onItemSelected?.(item, virtualRow.index);
              execute(ev, item);
            },
          };
          const active = !isStringItem && virtualRow.index === activeIndex;

          const childProps = {
            ...(isStringItem
              ? { 'aria-hidden': true }
              : {
                  id: getListboxItemId(virtualRow.index),
                  role: 'option',
                  'aria-selected': active,
                }),
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
                {...childProps}
              >
                {groupLabel ? <span className="sr-only">{groupLabel}: </span> : null}
                {renderedItem}
              </a>
            );
          }

          return (
            <div key={virtualRow.index} {...childProps}>
              {groupLabel ? <span className="sr-only">{groupLabel}: </span> : null}
              {renderedItem}
            </div>
          );
        })}
      </div>
    </div>
  );
};
