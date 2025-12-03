/**
 * Hook to track cursor positions relative to the viewport
 *
 * Determines if cursors are visible in the current viewport and calculates
 * edge positions for off-screen cursors to show indicators at the viewport edge.
 */

import { useMemo } from 'react';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

import { UserCursor } from '../state/types';
import { CanvasViewport } from '../state/types';

export interface CursorViewportInfo {
  cursor: UserCursor;
  isVisible: boolean;
  edgePosition?: {
    x: number; // Screen pixel position on the edge
    y: number; // Screen pixel position on the edge
    side: 'top' | 'bottom' | 'left' | 'right'; // Which edge
    distance: number; // Distance from viewport in canvas units
  };
}

interface UseCursorViewportTrackingOptions {
  cursors: Record<string, UserCursor>;
  viewport: CanvasViewport;
  transformRef: React.RefObject<ReactZoomPanPinchRef> | null;
  containerWidth: number;
  containerHeight: number;
}

const CANVAS_SIZE = 10000;
const EDGE_INDICATOR_MARGIN = 20; // Pixels from edge

/**
 * Calculate visible bounds of the viewport in canvas coordinates
 */
function getVisibleBounds(
  viewport: CanvasViewport,
  transformRef: React.RefObject<ReactZoomPanPinchRef> | null,
  containerWidth: number,
  containerHeight: number
) {
  // Get current transform state
  const scale = transformRef?.current?.state?.scale ?? viewport.zoom;
  const panX = transformRef?.current?.state?.positionX ?? viewport.panX;
  const panY = transformRef?.current?.state?.positionY ?? viewport.panY;

  // The pan values are in screen pixels and represent how much the canvas is shifted
  // Negative panX means the canvas is shifted left (showing more right content)
  // To convert to canvas coordinates, we need to:
  // 1. Negate the pan to get the offset
  // 2. Divide by scale to get canvas units

  const visibleLeft = -panX / scale;
  const visibleTop = -panY / scale;
  const visibleRight = visibleLeft + containerWidth / scale;
  const visibleBottom = visibleTop + containerHeight / scale;

  return {
    left: Math.max(0, visibleLeft),
    top: Math.max(0, visibleTop),
    right: Math.min(CANVAS_SIZE, visibleRight),
    bottom: Math.min(CANVAS_SIZE, visibleBottom),
    scale,
  };
}

/**
 * Calculate edge position for a cursor outside the viewport
 */
function calculateEdgePosition(
  cursor: UserCursor,
  bounds: ReturnType<typeof getVisibleBounds>,
  containerWidth: number,
  containerHeight: number
): CursorViewportInfo['edgePosition'] {
  const { left, top, right, bottom, scale } = bounds;
  const { x: cursorX, y: cursorY } = cursor;

  // Determine which edge(s) the cursor is beyond
  const isAbove = cursorY < top;
  const isBelow = cursorY > bottom;
  const isLeft = cursorX < left;
  const isRight = cursorX > right;

  // Calculate clamped position at viewport edges
  const clampedX = Math.max(left, Math.min(right, cursorX));
  const clampedY = Math.max(top, Math.min(bottom, cursorY));

  // Convert clamped canvas position to screen coordinates
  let screenX = (clampedX - left) * scale;
  let screenY = (clampedY - top) * scale;

  // Determine primary side and adjust to edge with margin
  let side: 'top' | 'bottom' | 'left' | 'right';
  let distance: number;

  // Priority: vertical edges over horizontal if both apply
  if (isLeft || isRight) {
    if (isLeft) {
      side = 'left';
      screenX = EDGE_INDICATOR_MARGIN;
      distance = left - cursorX;
    } else {
      side = 'right';
      screenX = containerWidth - EDGE_INDICATOR_MARGIN;
      distance = cursorX - right;
    }
  } else if (isAbove || isBelow) {
    if (isAbove) {
      side = 'top';
      screenY = EDGE_INDICATOR_MARGIN;
      distance = top - cursorY;
    } else {
      side = 'bottom';
      screenY = containerHeight - EDGE_INDICATOR_MARGIN;
      distance = cursorY - bottom;
    }
  } else {
    // Should not happen, but handle gracefully
    side = 'top';
    distance = 0;
  }

  // Clamp screen positions to container bounds with margin
  screenX = Math.max(EDGE_INDICATOR_MARGIN, Math.min(containerWidth - EDGE_INDICATOR_MARGIN, screenX));
  screenY = Math.max(EDGE_INDICATOR_MARGIN, Math.min(containerHeight - EDGE_INDICATOR_MARGIN, screenY));

  return {
    x: screenX,
    y: screenY,
    side,
    distance,
  };
}

/**
 * Track cursor positions relative to viewport
 */
export function useCursorViewportTracking({
  cursors,
  viewport,
  transformRef,
  containerWidth,
  containerHeight,
}: UseCursorViewportTrackingOptions): CursorViewportInfo[] {
  return useMemo(() => {
    if (containerWidth === 0 || containerHeight === 0) {
      return [];
    }

    const bounds = getVisibleBounds(viewport, transformRef, containerWidth, containerHeight);

    return Object.values(cursors).map((cursor) => {
      const { x, y } = cursor;
      const { left, top, right, bottom } = bounds;

      // Check if cursor is within visible bounds
      const isVisible = x >= left && x <= right && y >= top && y <= bottom;

      if (isVisible) {
        return { cursor, isVisible: true };
      }

      // Calculate edge position for off-screen cursor
      const edgePosition = calculateEdgePosition(cursor, bounds, containerWidth, containerHeight);

      return {
        cursor,
        isVisible: false,
        edgePosition,
      };
    });
  }, [cursors, viewport, transformRef, containerWidth, containerHeight]);
}
