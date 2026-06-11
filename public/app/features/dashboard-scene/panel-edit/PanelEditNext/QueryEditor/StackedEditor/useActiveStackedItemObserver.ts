import { type RefObject, useEffect, useRef } from 'react';

import { type StackedEditorItem } from '../QueryEditorContext';

import { getStackedItemKey, parseStackedItemType } from './utils';

interface UseActiveStackedItemObserverArgs {
  containerRef: RefObject<HTMLDivElement>;
  itemsKey: string;
  onActiveItemChange: (item: StackedEditorItem) => void;
}

interface VisibleEntry {
  item: StackedEditorItem;
  ratio: number;
  top: number;
}

function readStackedItem(element: Element): StackedEditorItem | null {
  const type = parseStackedItemType(element.getAttribute('data-stacked-editor-item-type'));
  const id = element.getAttribute('data-stacked-editor-item-id');
  return type && id ? { type, id } : null;
}

// Highest ratio wins; tie-break by closest to the top.
function pickDominant(visibleItems: Map<string, VisibleEntry>): [string, VisibleEntry] | undefined {
  let best: [string, VisibleEntry] | undefined;
  for (const entry of visibleItems) {
    const [, info] = entry;
    if (!best || info.ratio > best[1].ratio || (info.ratio === best[1].ratio && info.top < best[1].top)) {
      best = entry;
    }
  }
  return best;
}

/**
 * Watches the stacked editor's sections via IntersectionObserver and notifies the caller when the
 * dominant visible section changes. Dominance = highest intersection ratio, tie-break by closest
 * to the top.
 *
 * Callers decide whether to act on a change (e.g. the scroll hook ignores it while auto-following a
 * pinned card) — this hook only reports the dominant section.
 */
export function useActiveStackedItemObserver({
  containerRef,
  itemsKey,
  onActiveItemChange,
}: UseActiveStackedItemObserverArgs) {
  const activeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const visibleItems = new Map<string, VisibleEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = readStackedItem(entry.target);
          if (!item) {
            continue;
          }
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

        const dominant = pickDominant(visibleItems);
        if (!dominant) {
          return;
        }

        const [key, { item }] = dominant;

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
      observer.disconnect();
    };
    // itemsKey changes only when items are added/removed/reordered — not on every keystroke.
  }, [containerRef, itemsKey, onActiveItemChange]);
}
