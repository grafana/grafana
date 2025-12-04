/**
 * Custom hook for managing debug mode UI state in the panel data pane.
 *
 * This hook ONLY manages UI state (position, dragging, etc.).
 * The parent component is responsible for saving/syncing/restoring actual item states.
 * This keeps the hook pure and avoids side effects.
 */

import { useCallback, useEffect, useState } from 'react';

import { QueryTransformItem } from './types';

// Approximate height of card + gap for position calculations
const CARD_WITH_GAP = 80;

export interface UseDebugModeResult {
  // State
  isDebugMode: boolean;
  debugPosition: number;
  isDraggingDebugLine: boolean;
  dragOffset: number;

  // Actions
  toggleDebugMode: () => void;
  setDebugPosition: (position: number) => void;
  handleDebugLineMouseDown: (e: React.MouseEvent) => void;
  isItemHiddenByDebug: (itemId: string) => boolean | null;
}

export function useDebugMode(
  allItems: QueryTransformItem[],
  onPositionChange?: (newPosition: number) => void
): UseDebugModeResult {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugPosition, setDebugPosition] = useState(allItems.length);
  const [isDraggingDebugLine, setIsDraggingDebugLine] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Compute whether an item should be hidden by debug mode
  const isItemHiddenByDebug = useCallback(
    (itemId: string): boolean | null => {
      if (!isDebugMode) {
        return null; // Not in debug mode, use actual item state
      }

      const globalIndex = allItems.findIndex((i) => i.id === itemId);
      if (globalIndex === -1) {
        return null;
      }

      // Items at or after debugPosition are hidden
      return globalIndex >= debugPosition;
    },
    [isDebugMode, debugPosition, allItems]
  );

  const toggleDebugMode = useCallback(() => {
    if (!isDebugMode) {
      // When enabling debug mode, start with all items enabled
      setDebugPosition(allItems.length);
    }
    setIsDebugMode(!isDebugMode);
  }, [isDebugMode, allItems.length]);

  const handleDebugLineDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingDebugLine) {
        return;
      }

      // Calculate how far we've moved from the start
      const deltaY = e.clientY - dragStartY;
      setDragOffset(deltaY);
    },
    [isDraggingDebugLine, dragStartY]
  );

  const handleDebugLineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDraggingDebugLine(true);
      setDragStartY(e.clientY);
      setDragStartPosition(debugPosition);
      setDragOffset(0);
    },
    [debugPosition]
  );

  const handleDebugLineMouseUp = useCallback(() => {
    setIsDraggingDebugLine(false);

    // Snap to nearest card position
    const cardsMoved = Math.round(dragOffset / CARD_WITH_GAP);
    let newPosition = dragStartPosition + cardsMoved;

    // Clamp between 1 and allItems.length
    newPosition = Math.max(1, Math.min(allItems.length, newPosition));

    setDebugPosition(newPosition);
    setDragOffset(0);

    // Notify parent of position change so it can select the appropriate card
    onPositionChange?.(newPosition);
  }, [dragOffset, dragStartPosition, allItems.length, onPositionChange]);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDraggingDebugLine) {
      document.addEventListener('mousemove', handleDebugLineDrag);
      document.addEventListener('mouseup', handleDebugLineMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleDebugLineDrag);
        document.removeEventListener('mouseup', handleDebugLineMouseUp);
      };
    }
    return undefined;
  }, [isDraggingDebugLine, handleDebugLineDrag, handleDebugLineMouseUp]);

  // Cleanup drag state when debug mode is disabled
  useEffect(() => {
    if (!isDebugMode && isDraggingDebugLine) {
      setIsDraggingDebugLine(false);
      setDragOffset(0);
    }
  }, [isDebugMode, isDraggingDebugLine]);

  return {
    isDebugMode,
    debugPosition,
    isDraggingDebugLine,
    dragOffset,
    toggleDebugMode,
    setDebugPosition,
    handleDebugLineMouseDown,
    isItemHiddenByDebug,
  };
}
