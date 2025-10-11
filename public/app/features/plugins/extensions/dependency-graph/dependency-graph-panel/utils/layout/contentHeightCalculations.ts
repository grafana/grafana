/**
 * Content Height Calculation Functions
 *
 * Functions for calculating the total height needed for graph content.
 */

import { LAYOUT_CONSTANTS, getResponsiveGroupSpacing, getResponsiveMargin } from '../../constants';
import { GraphData, PanelOptions } from '../../types';

import { GROUPED_BOX_SPACING } from './layoutTypes';

/**
 * Calculate the total height needed for graph content
 */
export function calculateContentHeight(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): number {
  const margin = getResponsiveMargin(width);
  let spacing = 70; // Fixed spacing to match component spacing

  // Always add extra spacing for descriptions in expose mode
  if (isExposeMode) {
    spacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  } else if (options.showDescriptions) {
    spacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = getResponsiveGroupSpacing(height);
  let totalHeight = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 40; // Start with margin + header space

  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';

  if (isExtensionPointMode && data.extensions && data.extensions.length > 0) {
    // Group extensions by their providing plugin (app) - LEFT SIDE
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    let leftSideHeight = 0;
    Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
      const groupHeight = extensionIds.length * spacing + 30;
      leftSideHeight += groupHeight + groupSpacing;
    });

    // Group extension points by their defining plugin - RIGHT SIDE
    let rightSideHeight = 0;
    if (data.extensionPoints && data.extensionPoints.length > 0) {
      const extensionPointGroups = new Map<string, string[]>();
      data.extensionPoints.forEach((ep) => {
        if (!extensionPointGroups.has(ep.definingPlugin)) {
          extensionPointGroups.set(ep.definingPlugin, []);
        }
        extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
      });

      Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, extensionPointIds]) => {
        const groupHeight = extensionPointIds.length * spacing + 30;
        rightSideHeight += groupHeight + groupSpacing;
      });
    }

    // Use the maximum height from both sides
    totalHeight += Math.max(leftSideHeight, rightSideHeight);
  } else if (isExposeMode && data.exposedComponents && data.exposedComponents.length > 0) {
    // Group exposed components by their providing plugin
    const exposedComponentGroups = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!exposedComponentGroups.has(comp.providingPlugin)) {
        exposedComponentGroups.set(comp.providingPlugin, []);
      }
      exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
    });

    Array.from(exposedComponentGroups.entries()).forEach(([providingPlugin, componentIds]) => {
      // Find consumers for this specific provider section to calculate proper group height
      const sectionConsumers = new Set<string>();
      data.exposedComponents?.forEach((comp) => {
        if (comp.providingPlugin === providingPlugin) {
          comp.consumers.forEach((consumerId) => {
            sectionConsumers.add(consumerId);
          });
        }
      });

      // Calculate group height based on components only - consumers will align with component height
      const groupHeight = 80 + (componentIds.length - 1) * spacing + 40; // Header space + components + 40px bottom padding

      totalHeight += groupHeight + groupSpacing;
    });
  } else if (!isExposeMode && data.extensionPoints && data.extensionPoints.length > 0) {
    // Group extension points by their defining plugin, then by type to calculate total height
    const extensionPointGroups = new Map<string, Map<string, string[]>>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      let extensionType = ep.extensionType || 'link';

      if (!['function', 'component', 'link'].includes(extensionType)) {
        extensionType = 'link';
      }

      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
    });

    Array.from(extensionPointGroups.entries()).forEach(([_, typeGroups]) => {
      let groupHeight = 20; // Base group height
      const typeHeaderSpacing = GROUPED_BOX_SPACING.TYPE_HEADER_SPACING; // Space for type headers
      const typeOrder = ['function', 'component', 'link'];

      typeOrder.forEach((type) => {
        const extensionPointIds = typeGroups.get(type);
        if (extensionPointIds && extensionPointIds.length > 0) {
          groupHeight += typeHeaderSpacing; // Space for type header
          groupHeight += extensionPointIds.length * spacing;
        }
      });

      totalHeight += groupHeight + groupSpacing;
    });
  } else {
    return height; // Use panel height as minimum if no content
  }

  // Add extra bottom padding to ensure content is fully visible
  const finalHeight = Math.max(totalHeight + 100, height); // Use at least the panel height + 100px padding
  console.log('calculateContentHeight result:', {
    totalHeight,
    panelHeight: height,
    finalHeight,
    isExtensionPointMode,
    isExposeMode,
    extensionsCount: data.extensions?.length,
    extensionPointsCount: data.extensionPoints?.length,
  });
  return finalHeight;
}
