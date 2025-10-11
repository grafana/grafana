/**
 * Graph Layout Utility (Refactored)
 *
 * Main entry point for graph layout calculations. This file now imports
 * from focused modules for better organization and maintainability.
 */

import { getResponsiveMargin, getResponsiveNodeSpacing } from '../constants';
import { GraphData, PanelOptions } from '../types';
import { calculateContentHeight } from '../utils/layout/contentHeightCalculations';
import {
  calculateAddLayout,
  calculateExposeLayout,
  calculateExtensionPointLayout,
} from '../utils/layout/layoutCalculations';
import { NodeWithPosition } from '../utils/layout/layoutTypes';

/**
 * Main layout calculation function
 * Routes to appropriate layout calculation based on visualization mode
 */
export const calculateLayout = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number
): NodeWithPosition[] => {
  if (!data.nodes.length) {
    return [];
  }

  const margin = getResponsiveMargin(width);
  const nodeSpacing = getResponsiveNodeSpacing(height);
  const isExposeMode = options.visualizationMode === 'exposedComponents';
  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';

  if (isExposeMode) {
    return calculateExposeLayout(data, options, width, height, margin);
  } else if (isExtensionPointMode) {
    return calculateExtensionPointLayout(data, options, width, height, margin);
  } else {
    return calculateAddLayout(data, options, width, height, margin, nodeSpacing);
  }
};

// Note: For backward compatibility, import these directly from their respective modules:
// - NodeWithPosition, PositionInfo, GROUPED_BOX_SPACING from '../utils/layout/layoutTypes'
// - Position calculation functions from '../utils/layout/positionCalculations'
// - calculateContentHeight from '../utils/layout/contentHeightCalculations'
