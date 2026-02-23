import { DragStart, DragUpdate, DropResult } from '@hello-pangea/dnd';
import { useCallback, useRef, useState } from 'react';

interface IndicatorPosition {
  top: number;
  height: number;
}

interface UseDropIndicatorOptions {
  itemHeight: number;
  itemSpacing: number;
  onDragStart?: () => void;
  onDragEnd: (result: DropResult) => void;
}

/**
 * Manages the visual drop indicator for @hello-pangea/dnd lists.
 *
 * Computes the indicator position from known item dimensions (all items
 * are the same height) and locks the container height to prevent the
 * library's placeholder animation from shifting siblings.
 */
export function useDropIndicator({ itemHeight, itemSpacing, onDragStart, onDragEnd }: UseDropIndicatorOptions) {
  const [indicator, setIndicator] = useState<IndicatorPosition | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleBeforeCapture = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.style.height = `${container.getBoundingClientRect().height}px`;
    container.style.overflow = 'hidden';
    document.documentElement.dataset.dragging = '';
  }, []);

  const handleDragStart = useCallback(
    (start: DragStart) => {
      const idx = start.source.index;
      setIndicator({ top: idx * (itemHeight + itemSpacing), height: itemHeight });
      onDragStart?.();
    },
    [onDragStart, itemHeight, itemSpacing]
  );

  const handleDragUpdate = useCallback(
    (update: DragUpdate) => {
      if (!update.destination) {
        setIndicator(null);
        return;
      }
      const idx = update.destination.index;
      setIndicator({ top: idx * (itemHeight + itemSpacing), height: itemHeight });
    },
    [itemHeight, itemSpacing]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (containerRef.current) {
        containerRef.current.style.height = '';
        containerRef.current.style.overflow = '';
      }
      delete document.documentElement.dataset.dragging;
      setIndicator(null);
      onDragEnd(result);
    },
    [onDragEnd]
  );

  return {
    indicator,
    containerRef,
    handleBeforeCapture,
    handleDragStart,
    handleDragUpdate,
    handleDragEnd,
  };
}
