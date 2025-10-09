import { useMemo } from 'react';

import {
  calculateContentHeight,
  calculateLayout,
  getExposedComponentPositions,
  getExtensionPointModePositions,
  getExtensionPointPositions,
  getExtensionPositions,
} from '../components/GraphLayout';
import { GraphData, PanelOptions } from '../types';

interface UseDependencyGraphPositionsProps {
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
}

/**
 * Custom hook for managing dependency graph position calculations
 *
 * This hook encapsulates all the position calculation logic for the dependency graph,
 * including layout calculations and position memoization.
 */
export function useDependencyGraphPositions({
  data,
  options,
  width,
  height,
  isExposeMode,
  isExtensionPointMode,
}: UseDependencyGraphPositionsProps) {
  // Memoized layout calculation
  const layoutNodes = useMemo(() => calculateLayout(data, options, width, height), [data, options, width, height]);

  const contentHeight = useMemo(() => {
    const calculatedHeight = calculateContentHeight(data, options, width, height, isExposeMode || isExtensionPointMode);
    // For full height behavior, use the calculated height if it's larger than the available height
    // This allows the content to expand beyond the viewport and make the page scrollable
    console.log('Content height calculation:', {
      calculatedHeight,
      panelHeight: height,
      dataNodes: data.nodes?.length,
      dataExtensions: data.extensions?.length,
      dataExtensionPoints: data.extensionPoints?.length,
      isExposeMode,
      isExtensionPointMode,
    });
    return calculatedHeight;
  }, [data, options, width, height, isExposeMode, isExtensionPointMode]);

  // Memoized position calculations
  const extensionPointPositions = useMemo(
    () => getExtensionPointPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const exposedComponentPositions = useMemo(
    () => getExposedComponentPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const extensionPositions = useMemo(
    () => getExtensionPositions(data, options, width, height, isExtensionPointMode),
    [data, options, width, height, isExtensionPointMode]
  );

  const extensionPointModePositions = useMemo(
    () => getExtensionPointModePositions(data, options, width, height, isExtensionPointMode),
    [data, options, width, height, isExtensionPointMode]
  );

  return {
    layoutNodes,
    contentHeight,
    extensionPointPositions,
    exposedComponentPositions,
    extensionPositions,
    extensionPointModePositions,
  };
}
