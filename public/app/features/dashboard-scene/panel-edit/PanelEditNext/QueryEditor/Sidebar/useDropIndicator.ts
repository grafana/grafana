import { DragStart, DragUpdate, DropResult } from '@hello-pangea/dnd';
import { useCallback, useRef, useState } from 'react';

interface IndicatorPosition {
  top: number;
  height: number;
}

interface UseDropIndicatorOptions {
  itemCount: number;
  onDragStart?: () => void;
  onDragEnd: (result: DropResult) => void;
}

/**
 * Manages the visual drop indicator for @hello-pangea/dnd lists.
 *
 * Computes the indicator position from snapshotted item dimensions
 * (captured once before drag) and locks the container height to
 * prevent the library's placeholder animation from shifting siblings.
 */
export function useDropIndicator({ itemCount, onDragStart, onDragEnd }: UseDropIndicatorOptions) {
  const [indicator, setIndicator] = useState<IndicatorPosition | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const itemRefsMap = useRef<Map<number, HTMLElement>>(new Map());
  const itemHeightsRef = useRef<number[]>([]);
  const itemSpacingRef = useRef(0);

  const setItemRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      itemRefsMap.current.set(index, el);
    } else {
      itemRefsMap.current.delete(index);
    }
  }, []);

  const computePosition = useCallback((src: number, dest: number): IndicatorPosition => {
    const heights = itemHeightsRef.current;
    const spacing = itemSpacingRef.current;

    // Sum the heights of items that appear before `dest` in the reordered list.
    // When dest <= src, those are simply items 0..dest-1 (all below src, unaffected).
    // When dest > src, items shift up to fill src's gap, so we sum 0..dest skipping src.
    let top = dest * spacing;
    if (dest <= src) {
      for (let i = 0; i < dest; i++) {
        top += heights[i];
      }
    } else {
      for (let i = 0; i <= dest; i++) {
        if (i !== src) {
          top += heights[i];
        }
      }
    }

    return { top, height: heights[src] };
  }, []);

  const handleBeforeCapture = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Batch all DOM reads before writes to avoid layout thrashing
    const containerHeight = container.getBoundingClientRect().height;

    const heights = Array.from({ length: itemCount }, (_, i) => {
      const el = itemRefsMap.current.get(i);
      return el ? el.getBoundingClientRect().height : 0;
    });

    let spacing = 0;
    if (itemCount >= 2) {
      const first = itemRefsMap.current.get(0);
      const second = itemRefsMap.current.get(1);
      if (first && second) {
        spacing = second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
      }
    }

    // Write phase: lock container height to prevent the placeholder animation from pushing siblings
    container.style.height = `${containerHeight}px`;
    container.style.overflow = 'hidden';
    itemHeightsRef.current = heights;
    itemSpacingRef.current = spacing;
  }, [itemCount]);

  const handleDragStart = useCallback(
    (start: DragStart) => {
      setIndicator(computePosition(start.source.index, start.source.index));
      onDragStart?.();
    },
    [onDragStart, computePosition]
  );

  const handleDragUpdate = useCallback(
    (update: DragUpdate) => {
      if (!update.destination) {
        setIndicator(null);
        return;
      }
      setIndicator(computePosition(update.source.index, update.destination.index));
    },
    [computePosition]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (containerRef.current) {
        containerRef.current.style.height = '';
        containerRef.current.style.overflow = '';
      }
      setIndicator(null);
      onDragEnd(result);
    },
    [onDragEnd]
  );

  return {
    indicator,
    containerRef,
    setItemRef,
    handleBeforeCapture,
    handleDragStart,
    handleDragUpdate,
    handleDragEnd,
  };
}
