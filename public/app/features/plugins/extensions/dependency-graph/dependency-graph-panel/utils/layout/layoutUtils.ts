/**
 * Layout Utility Functions
 *
 * Utility functions for graph layout calculations.
 */

import { GROUPED_BOX_SPACING, PositionInfo } from './layoutTypes';

/**
 * Unified positioning function for all grouped boxes.
 * This ensures consistent spacing across all views.
 */
export function calculateUnifiedGroupedBoxPositions(
  currentGroupY: number,
  itemIds: string[],
  xPosition: number,
  typeHeaderSpacing = 0,
  boxHeights: number[] = []
): { positions: Map<string, PositionInfo>; groupHeight: number } {
  const positions = new Map<string, PositionInfo>();
  let totalHeight = GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX + typeHeaderSpacing;

  itemIds.forEach((itemId, index) => {
    const boxHeight = boxHeights[index] || GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES;
    const yPosition = currentGroupY + totalHeight;

    positions.set(itemId, {
      x: xPosition,
      y: yPosition,
      groupY: currentGroupY,
      groupHeight: totalHeight + boxHeight + GROUPED_BOX_SPACING.BOTTOM_PADDING,
    });

    totalHeight += boxHeight + GROUPED_BOX_SPACING.INNER_BOX_GAP;
  });

  return {
    positions,
    groupHeight: totalHeight + GROUPED_BOX_SPACING.BOTTOM_PADDING,
  };
}
