/**
 * Layout Types and Constants
 *
 * Type definitions and constants for graph layout calculations.
 */

import { PluginNode } from '../../types';

export interface NodeWithPosition extends PluginNode {
  x: number;
  y: number;
  originalId?: string; // For handling multiple instances of same consumer
}

export interface PositionInfo {
  x: number;
  y: number;
  groupY: number;
  groupHeight: number;
  typeHeaderY?: number; // Y position for type header
  extensionType?: string; // Extension type for this position
}

// Unified spacing constants for grouped boxes (boxes inside boxes)
export const GROUPED_BOX_SPACING = {
  // Spacing from main group heading to first inner box
  HEADER_TO_FIRST_BOX: 40, // Increased from 25 to 40 to prevent overlap with heading
  // Distance between last box and parent border
  BOTTOM_PADDING: -16, // Larger negative padding to further reduce bottom spacing
  // Gap between each inner box (8px gap between boxes)
  INNER_BOX_GAP: 8,
  // Type header spacing (used in views that have type headers)
  TYPE_HEADER_SPACING: 40,
  // Box heights based on content lines
  BOX_HEIGHT_ONE_LINE: 50, // ID only
  BOX_HEIGHT_TWO_LINES: 60, // Title + ID
  BOX_HEIGHT_THREE_LINES: 80, // Title + ID + Description
} as const;
