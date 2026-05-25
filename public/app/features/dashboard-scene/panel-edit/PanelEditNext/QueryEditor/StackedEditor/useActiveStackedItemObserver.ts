import { type MutableRefObject, type RefObject, useEffect, useRef } from 'react';

import { type StackedEditorItem } from '../QueryEditorContext';

import { getStackedItemKey, parseStackedItemType } from './utils';

interface UseActiveStackedItemObserverArgs {
  containerRef: RefObject<HTMLDivElement>;
  itemsKey: string;
  onActiveItemChange: (item: StackedEditorItem) => void;
  pendingScrollKeyRef: MutableRefObject<string | null>;
}

export function useActiveStackedItemObserver({
  containerRef,
  itemsKey,
  onActiveItemChange,
  pendingScrollKeyRef,
}: UseActiveStackedItemObserverArgs) {
  const activeKeyRef = useRef<string | null>(null);
  const visibleItemsRef = useRef(new Map<string, { item: StackedEditorItem; ratio: number; top: number }>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const visibleItems = visibleItemsRef.current;
    visibleItems.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target;
          const type = parseStackedItemType(element.getAttribute('data-stacked-editor-item-type'));
          const id = element.getAttribute('data-stacked-editor-item-id');

          if (!type || !id) {
            continue;
          }

          const item = { type, id };
          const key = getStackedItemKey(item);

          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            visibleItems.set(key, {
              item,
              ratio: entry.intersectionRatio,
              top: entry.boundingClientRect.top,
            });
          } else {
            visibleItems.delete(key);
          }
        }

        const nextActive = Array.from(visibleItems.entries()).sort(([, a], [, b]) => {
          if (b.ratio !== a.ratio) {
            return b.ratio - a.ratio;
          }
          return a.top - b.top;
        })[0];

        if (!nextActive) {
          return;
        }

        // Read the pending scroll target via ref so the observer is not re-created on every
        // sidebar click (and the closure can't go stale between intersection events).
        const pendingKey = pendingScrollKeyRef.current;
        if (pendingKey) {
          if (nextActive[0] !== pendingKey) {
            return;
          }
          pendingScrollKeyRef.current = null;
        }

        const [key, { item }] = nextActive;
        if (activeKeyRef.current !== key) {
          activeKeyRef.current = key;
          onActiveItemChange(item);
        }
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const observedItems = container.querySelectorAll<HTMLElement>('[data-stacked-editor-item-id]');
    observedItems.forEach((item) => observer.observe(item));

    return () => {
      visibleItems.clear();
      observer.disconnect();
    };
    // itemsKey changes only when items are added/removed/reordered — not on every keystroke.
  }, [containerRef, itemsKey, onActiveItemChange, pendingScrollKeyRef]);
}
