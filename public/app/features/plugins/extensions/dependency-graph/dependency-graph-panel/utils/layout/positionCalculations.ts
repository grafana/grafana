/**
 * Position Calculation Functions
 *
 * Functions for calculating positions of extension points, exposed components, and extensions.
 */

import { LAYOUT_CONSTANTS, getResponsiveGroupSpacing, getResponsiveMargin } from '../../constants';
import { GraphData, PanelOptions } from '../../types';

import { PositionInfo } from './layoutTypes';
import { calculateUnifiedGroupedBoxPositions } from './layoutUtils';

/**
 * Get positions for extension points in expose mode
 */
export function getExtensionPointPositions(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): Map<string, PositionInfo> {
  if (!isExposeMode || !data.extensionPoints?.length) {
    return new Map();
  }

  const margin = getResponsiveMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group extension points by provider
  const extensionPointsByProvider = new Map<string, string[]>();
  data.extensionPoints.forEach((ep) => {
    const provider = ep.definingPlugin;
    if (!extensionPointsByProvider.has(provider)) {
      extensionPointsByProvider.set(provider, []);
    }
    extensionPointsByProvider.get(provider)!.push(ep.id);
  });

  const positions = new Map<string, PositionInfo>();
  let currentY = LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing;

  // Position extension points for each provider
  extensionPointsByProvider.forEach((extensionPointIds, provider) => {
    const { positions: providerPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentY,
      extensionPointIds,
      margin + LAYOUT_CONSTANTS.MIN_NODE_WIDTH + 20
    );

    providerPositions.forEach((pos, id) => {
      positions.set(id, pos);
    });

    currentY += groupHeight + groupSpacing;
  });

  return positions;
}

/**
 * Get positions for exposed components in expose mode
 */
export function getExposedComponentPositions(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): Map<string, PositionInfo> {
  if (!isExposeMode || !data.exposedComponents?.length) {
    return new Map();
  }

  const margin = getResponsiveMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group exposed components by provider
  const componentsByProvider = new Map<string, string[]>();
  data.exposedComponents.forEach((comp) => {
    const provider = comp.providingPlugin;
    if (!componentsByProvider.has(provider)) {
      componentsByProvider.set(provider, []);
    }
    componentsByProvider.get(provider)!.push(comp.id);
  });

  const positions = new Map<string, PositionInfo>();
  let currentY = LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing;

  // Position exposed components for each provider
  componentsByProvider.forEach((componentIds, provider) => {
    const { positions: providerPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentY,
      componentIds,
      margin + LAYOUT_CONSTANTS.MIN_NODE_WIDTH + 20
    );

    providerPositions.forEach((pos, id) => {
      positions.set(id, pos);
    });

    currentY += groupHeight + groupSpacing;
  });

  return positions;
}

/**
 * Get positions for extensions in extension point mode
 */
export function getExtensionPositions(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExtensionPointMode: boolean
): Map<string, PositionInfo> {
  if (!isExtensionPointMode || !data.extensions?.length) {
    return new Map();
  }

  const margin = getResponsiveMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group extensions by extension point
  const extensionsByExtensionPoint = new Map<string, string[]>();
  data.extensions.forEach((ext) => {
    const extensionPoint = ext.targetExtensionPoint;
    if (!extensionsByExtensionPoint.has(extensionPoint)) {
      extensionsByExtensionPoint.set(extensionPoint, []);
    }
    extensionsByExtensionPoint.get(extensionPoint)!.push(ext.id);
  });

  const positions = new Map<string, PositionInfo>();
  let currentY = LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing;

  // Position extensions for each extension point
  extensionsByExtensionPoint.forEach((extensionIds, extensionPoint) => {
    const { positions: extensionPointPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentY,
      extensionIds,
      margin + LAYOUT_CONSTANTS.MIN_NODE_WIDTH + 20
    );

    extensionPointPositions.forEach((pos, id) => {
      positions.set(id, pos);
    });

    currentY += groupHeight + groupSpacing;
  });

  return positions;
}

/**
 * Get positions for extension points in extension point mode
 */
export function getExtensionPointModePositions(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExtensionPointMode: boolean
): Map<string, PositionInfo> {
  if (!isExtensionPointMode || !data.extensionPoints?.length) {
    return new Map();
  }

  const margin = getResponsiveMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group extension points by provider
  const extensionPointsByProvider = new Map<string, string[]>();
  data.extensionPoints.forEach((ep) => {
    const provider = ep.definingPlugin;
    if (!extensionPointsByProvider.has(provider)) {
      extensionPointsByProvider.set(provider, []);
    }
    extensionPointsByProvider.get(provider)!.push(ep.id);
  });

  const positions = new Map<string, PositionInfo>();
  let currentY = LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing;

  // Position extension points for each provider
  extensionPointsByProvider.forEach((extensionPointIds, provider) => {
    const { positions: providerPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentY,
      extensionPointIds,
      margin + LAYOUT_CONSTANTS.MIN_NODE_WIDTH + 20
    );

    providerPositions.forEach((pos, id) => {
      positions.set(id, pos);
    });

    currentY += groupHeight + groupSpacing;
  });

  return positions;
}
