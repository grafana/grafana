import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { type StackedEditorItem } from '../QueryEditorContext';

import { useActiveStackedItemObserver } from './useActiveStackedItemObserver';
import { getStackedItemKey, getStackedItemsKey, type StackedItem } from './utils';

interface UseStackedItemScrollArgs {
  /** The scrollable viewport. scrollIntoView targets the section's nearest scrollable ancestor. */
  containerRef: RefObject<HTMLDivElement>;
  /** Wrapper around the sections, observed for size changes as their async editors finish loading. */
  contentRef: RefObject<HTMLDivElement>;
  items: readonly StackedItem[];
  /** The currently selected card. While auto-following we keep it pinned to the top of the view. */
  selectedItem: StackedEditorItem | null;
  /** Called when the user scrolls to a different card, so selection can follow the scroll position. */
  onActiveItemChange: (item: StackedEditorItem) => void;
}

function findSection(container: HTMLElement, item: StackedEditorItem): HTMLElement | null {
  const sections = container.querySelectorAll<HTMLElement>('[data-stacked-editor-item-id]');
  for (const section of sections) {
    if (section.dataset.stackedEditorItemId === item.id && section.dataset.stackedEditorItemType === item.type) {
      return section;
    }
  }
  return null;
}

/**
 * Keeps the selected card and the scroll position in sync, as a two-mode state machine:
 *
 * - **auto-follow** (on open and after any deliberate selection change): the selected card is pinned
 *   to the top. The IntersectionObserver is ignored, and a ResizeObserver re-pins as the sections'
 *   async datasource editors finish loading and grow — otherwise an early scroll lands on a stale
 *   offset once content above expands.
 * - **manual** (entered the moment the user scrolls): the IntersectionObserver drives selection from
 *   the scroll position, and re-pinning stops so we never fight deliberate navigation.
 *
 * A selection change that didn't originate from scrolling flips us back to auto-follow.
 * `scrollSyncedKeyRef` tags observer-driven selection changes so the auto-scroll effect can tell
 * them apart from external (sidebar/open) ones and avoid yanking the user back.
 */
export function useStackedItemScroll({
  containerRef,
  contentRef,
  items,
  selectedItem,
  onActiveItemChange,
}: UseStackedItemScrollArgs): void {
  const autoFollowRef = useRef(true);
  const scrollSyncedKeyRef = useRef<string | null>(null);

  // Latest selected item, read by the resize/scroll callbacks without making them reactive deps.
  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;

  const scrollSelectedIntoView = useCallback(
    (behavior: ScrollBehavior) => {
      const item = selectedItemRef.current;
      const container = containerRef.current;
      const section = item && container && findSection(container, item);
      section?.scrollIntoView?.({ block: 'start', behavior });
    },
    [containerRef]
  );

  // Pin the selected card whenever it changes from an external source (open / sidebar click), but
  // not when the change echoed back from the user scrolling — that would yank them back. Smooth so
  // deliberate navigation animates; safe because auto-follow ignores the observer mid-scroll.
  const selectedKey = selectedItem ? getStackedItemKey(selectedItem) : null;
  useLayoutEffect(() => {
    if (!selectedKey) {
      return;
    }
    if (selectedKey === scrollSyncedKeyRef.current) {
      return;
    }
    autoFollowRef.current = true;
    scrollSelectedIntoView('smooth');
  }, [selectedKey, scrollSelectedIntoView]);

  // Re-pin while auto-following as content grows; the first user scroll switches to manual.
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container || typeof ResizeObserver === 'undefined') {
      return;
    }

    // Instant corrections: as content loads it can grow faster than a smooth animation completes,
    // and chained smooth scrolls would lag behind the growth. The deliberate scroll above is smooth.
    const resizeObserver = new ResizeObserver(() => {
      if (autoFollowRef.current) {
        scrollSelectedIntoView('auto');
      }
    });
    resizeObserver.observe(content);

    // User-intent events only — not 'scroll', which our own programmatic scrolls would trigger.
    const onUserScroll = () => {
      autoFollowRef.current = false;
    };
    // keydown bubbles up from the section editors and inputs, so only count keys pressed on the
    // scroll region itself (keyboard scrolling) as intent — not typing inside a card.
    const onContainerKeyDown = (event: KeyboardEvent) => {
      if (event.target === container) {
        autoFollowRef.current = false;
      }
    };
    container.addEventListener('wheel', onUserScroll, { passive: true });
    container.addEventListener('touchmove', onUserScroll, { passive: true });
    container.addEventListener('keydown', onContainerKeyDown);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('wheel', onUserScroll);
      container.removeEventListener('touchmove', onUserScroll);
      container.removeEventListener('keydown', onContainerKeyDown);
    };
  }, [containerRef, contentRef, scrollSelectedIntoView]);

  // While auto-following the selection is owned by the pin, so ignore the observer. Once the user
  // takes over, mirror their scroll position into the selection (tagging it so the effect above
  // recognises the echo and doesn't scroll back).
  const handleActiveItemChange = useCallback(
    (item: StackedEditorItem) => {
      if (autoFollowRef.current) {
        return;
      }
      scrollSyncedKeyRef.current = getStackedItemKey(item);
      onActiveItemChange(item);
    },
    [onActiveItemChange]
  );

  useActiveStackedItemObserver({
    containerRef,
    itemsKey: getStackedItemsKey(items),
    onActiveItemChange: handleActiveItemChange,
  });
}
