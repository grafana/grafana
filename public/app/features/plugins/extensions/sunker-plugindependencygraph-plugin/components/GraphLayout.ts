/**
 * Graph Layout Utility
 *
 * Handles layout calculations for both add and expose modes of the dependency graph.
 */

import {
  LAYOUT_CONSTANTS,
  getResponsiveGroupSpacing,
  getResponsiveMargin,
  getResponsiveNodeSpacing,
  getResponsiveNodeWidth,
  getRightMargin,
} from '../constants';
import { GraphData, PanelOptions, PluginNode } from '../types';

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
}

/**
 * Calculate optimal node positions for the dependency graph layout.
 *
 * This function determines the (x, y) coordinates for all plugin nodes based on the
 * visualization mode and available space. It implements responsive positioning that
 * adapts to different panel sizes.
 *
 * @param data - Graph data containing nodes and dependency information
 * @param options - Panel configuration including visualization mode and display options
 * @param width - Available width for the visualization in pixels
 * @param height - Available height for the visualization in pixels
 * @returns Array of nodes with calculated positions
 *
 * @example
 * ```typescript
 * const positions = calculateLayout(graphData, options, 800, 600);
 * console.log(positions[0]); // { id: 'plugin-1', x: 100, y: 200, ... }
 * ```
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
  const isExposeMode = options.visualizationMode === 'expose';
  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';

  if (isExposeMode) {
    return calculateExposeLayout(data, options, width, height, margin);
  } else if (isExtensionPointMode) {
    return calculateExtensionPointLayout(data, options, width, height, margin);
  } else {
    return calculateAddLayout(data, width, height, margin, nodeSpacing);
  }
};

/**
 * Calculate layout for expose mode
 */
const calculateExposeLayout = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  margin: number
): NodeWithPosition[] => {
  const result: NodeWithPosition[] = [];

  // Identify content providers and consumers
  const contentProviders = new Set<string>();
  const contentConsumers = new Set<string>();

  if (data.exposedComponents) {
    data.exposedComponents.forEach((comp) => {
      contentProviders.add(comp.providingPlugin);
    });
  }

  data.dependencies.forEach((dep) => {
    contentConsumers.add(dep.source); // Source is the consumer in expose mode
  });

  const providerNodes = data.nodes.filter((node) => contentProviders.has(node.id));

  if (data.exposedComponents) {
    // Group exposed components by provider
    const componentGroupsByProvider = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!componentGroupsByProvider.has(comp.providingPlugin)) {
        componentGroupsByProvider.set(comp.providingPlugin, []);
      }
      componentGroupsByProvider.get(comp.providingPlugin)!.push(comp.id);
    });

    // Consumer positioning - position consumers per provider section, but avoid duplicates
    const rightMargin = getRightMargin(width);
    const consumerX = width - rightMargin - getResponsiveNodeWidth(width) / 2;

    // Component spacing
    let componentSpacing = 70; // Fixed spacing to match other functions
    if (options.showDescriptions) {
      componentSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }

    const groupSpacing = getResponsiveGroupSpacing(height) + 30; // Extra space for dotted lines
    let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 10; // Start extremely close to headers and dotted lines

    // Position consumers per provider section - each consumer appears in every section they're connected to
    Array.from(componentGroupsByProvider.entries()).forEach(([providingPlugin, componentIds]) => {
      // Find consumers for this specific provider section first
      const sectionConsumers = new Set<string>();
      data.exposedComponents?.forEach((comp) => {
        if (comp.providingPlugin === providingPlugin) {
          comp.consumers.forEach((consumerId) => {
            sectionConsumers.add(consumerId);
          });
        }
      });

      const sectionConsumerArray = Array.from(sectionConsumers);
      const consumerSpacing = Math.max(componentSpacing, 80); // Ensure proper spacing for consumer boxes

      // Calculate group height based on components only - consumers will align with component height
      const groupHeight = 80 + (componentIds.length - 1) * componentSpacing + 60 + 12; // Header space + components + component height + bottom padding
      const groupCenterY = currentGroupY + groupHeight / 2;

      // Position provider node (for layout calculation, but won't be rendered)
      const providerNode = providerNodes.find((node) => node.id === providingPlugin);
      if (providerNode) {
        const nodeWidth = getResponsiveNodeWidth(width);
        const providerX = margin + nodeWidth / 2;
        result.push({
          ...providerNode,
          x: providerX,
          y: groupCenterY,
        });
      }

      // Position consumer instances for this provider section
      const consumersStartY = currentGroupY + 57; // Start within the section

      sectionConsumerArray.forEach((consumerId, consumerIndex) => {
        const consumerNode = data.nodes.find((n) => n.id === consumerId);
        if (consumerNode) {
          result.push({
            ...consumerNode,
            id: `${consumerId}-at-${providingPlugin}`, // Unique ID for this section instance
            originalId: consumerId, // Keep track of original ID
            x: consumerX,
            y: consumersStartY + consumerIndex * consumerSpacing,
          });
        }
      });

      currentGroupY += groupHeight + groupSpacing;
    });
  }

  return result;
};

/**
 * Calculate layout for extension point mode
 */
const calculateExtensionPointLayout = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  margin: number
): NodeWithPosition[] => {
  const result: NodeWithPosition[] = [];

  if (!data.extensions || !data.extensionPoints) {
    return result;
  }

  // For extension point mode, we don't need to position plugin nodes
  // The extensions and extension points will be positioned separately
  return result;
};

/**
 * Calculate layout for add mode
 */
const calculateAddLayout = (
  data: GraphData,
  width: number,
  height: number,
  margin: number,
  nodeSpacing: number
): NodeWithPosition[] => {
  const result: NodeWithPosition[] = [];

  if (!data.extensionPoints) {
    return result;
  }

  // Identify content providers
  const contentProviders = new Set<string>();
  data.dependencies.forEach((dep) => {
    const extensionPoint = data.extensionPoints?.find((ep) => ep.id === dep.target);
    if (extensionPoint) {
      contentProviders.add(dep.source);
    }
  });

  const providerNodes = data.nodes.filter((node) => contentProviders.has(node.id));

  // Place content provider apps on the left
  const providerStartY = margin + 120; // Increased from 100 to 120 for more distance from dotted line
  providerNodes.forEach((node, index) => {
    result.push({
      ...node,
      x: margin + 113, // Adjusted from 90 to 113 to account for wider boxes (90 + 23)
      y: providerStartY + index * nodeSpacing,
    });
  });

  return result;
};

/**
 * Calculate positions for extension points in add mode visualization.
 *
 * Extension points are positioned on the right side of the visualization,
 * grouped by their defining plugin. Each group contains multiple extension
 * points with consistent spacing.
 *
 * @param data - Graph data containing extension points
 * @param options - Panel options that affect spacing (e.g., showDescriptions)
 * @param width - Panel width for responsive positioning
 * @param height - Panel height for responsive spacing
 * @param isExposeMode - If true, returns empty map (expose mode doesn't use extension points)
 * @returns Map of extension point IDs to their position information
 */
export const getExtensionPointPositions = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): Map<string, PositionInfo> => {
  if (isExposeMode || !data.extensionPoints) {
    return new Map();
  }

  // Group extension points by their defining plugin
  const extensionPointGroups = new Map<string, string[]>();
  data.extensionPoints.forEach((ep) => {
    if (!extensionPointGroups.has(ep.definingPlugin)) {
      extensionPointGroups.set(ep.definingPlugin, []);
    }
    extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
  });

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  let extensionPointSpacing = 65;
  if (options.showDescriptions) {
    extensionPointSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = 40;
  const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
  const rightSideX = width - margin - extensionBoxWidth - LAYOUT_CONSTANTS.ARROW_SAFETY_MARGIN;

  let currentGroupY = margin + 110; // Increased from 90 to 110 for more distance from dotted line

  Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, extensionPointIds]) => {
    const groupHeight = extensionPointIds.length * extensionPointSpacing + 50;

    extensionPointIds.forEach((epId, index) => {
      positions.set(epId, {
        x: rightSideX,
        y: currentGroupY + 70 + index * extensionPointSpacing,
        groupY: currentGroupY,
        groupHeight: groupHeight,
      });
    });

    currentGroupY += groupHeight + groupSpacing;
  });

  return positions;
};

/**
 * Calculate positions for exposed components in expose mode visualization.
 *
 * Exposed components are positioned in the center of the visualization,
 * grouped by their providing plugin. They act as the central focus point
 * with arrows flowing from providers to components and from components to consumers.
 *
 * @param data - Graph data containing exposed components
 * @param options - Panel options that affect spacing and display
 * @param width - Panel width for responsive positioning
 * @param height - Panel height for responsive spacing
 * @param isExposeMode - If false, returns empty map (add mode doesn't use exposed components)
 * @returns Map of exposed component IDs to their position information
 */
export const getExposedComponentPositions = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): Map<string, PositionInfo> => {
  if (!isExposeMode || !data.exposedComponents) {
    return new Map();
  }

  // Group exposed components by their providing plugin
  const exposedComponentGroups = new Map<string, string[]>();
  data.exposedComponents.forEach((comp) => {
    if (!exposedComponentGroups.has(comp.providingPlugin)) {
      exposedComponentGroups.set(comp.providingPlugin, []);
    }
    exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
  });

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  let componentSpacing = 70; // Adequate spacing between components (60px height + 10px margin)
  if (options.showDescriptions) {
    componentSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = getResponsiveGroupSpacing(height) + 30; // Extra space for dotted lines

  // Position components inside their provider boxes instead of at center
  // Ensure provider boxes have enough space and don't overflow left side
  const providerBoxX = margin + 10; // Provider box starts with margin from left edge
  const componentX = providerBoxX + 20; // Position component inside provider box with 20px left padding

  let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30; // Start below the dashed line with proper spacing

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
    const groupHeight = 80 + (componentIds.length - 1) * componentSpacing + 60 + 12; // Header space + components + component height + bottom padding

    componentIds.forEach((compId, index) => {
      positions.set(compId, {
        x: componentX,
        y: currentGroupY + 80 + index * componentSpacing,
        groupY: currentGroupY,
        groupHeight: groupHeight,
      });
    });

    currentGroupY += groupHeight + groupSpacing;
  });

  return positions;
};

/**
 * Calculate positions for extensions in extension point mode visualization.
 *
 * Extensions are positioned on the left side of the visualization,
 * grouped by their providing plugin. Each extension box shows the
 * extension title and description.
 *
 * @param data - Graph data containing extensions
 * @param options - Panel options that affect spacing (e.g., showDescriptions)
 * @param width - Panel width for responsive positioning
 * @param height - Panel height for responsive spacing
 * @param isExtensionPointMode - If false, returns empty map (other modes don't use extensions)
 * @returns Map of extension IDs to their position information
 */
export const getExtensionPositions = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExtensionPointMode: boolean
): Map<string, PositionInfo> => {
  if (!isExtensionPointMode || !data.extensions) {
    return new Map();
  }

  // Group extensions by their providing plugin (app)
  const extensionGroups = new Map<string, string[]>();
  data.extensions.forEach((ext) => {
    if (!extensionGroups.has(ext.providingPlugin)) {
      extensionGroups.set(ext.providingPlugin, []);
    }
    extensionGroups.get(ext.providingPlugin)!.push(ext.id);
  });

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  let extensionSpacing = 70;
  if (options.showDescriptions) {
    extensionSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = getResponsiveGroupSpacing(height) + 30;
  const leftSideX = margin + 20; // Position on the left side

  let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30;

  // Process each app section
  Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
    const groupHeight = extensionIds.length * extensionSpacing + 50;

    extensionIds.forEach((extId, index) => {
      positions.set(extId, {
        x: leftSideX,
        y: currentGroupY + 70 + index * extensionSpacing,
        groupY: currentGroupY,
        groupHeight: groupHeight,
      });
    });

    currentGroupY += groupHeight + groupSpacing;
  });

  return positions;
};

/**
 * Calculate positions for extension points in extension point mode visualization.
 *
 * Extension points are positioned on the right side of the visualization.
 * Each extension point box shows the extension point title and description.
 *
 * @param data - Graph data containing extension points
 * @param options - Panel options that affect spacing (e.g., showDescriptions)
 * @param width - Panel width for responsive positioning
 * @param height - Panel height for responsive spacing
 * @param isExtensionPointMode - If false, returns empty map (other modes don't use this layout)
 * @returns Map of extension point IDs to their position information
 */
export const getExtensionPointModePositions = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExtensionPointMode: boolean
): Map<string, PositionInfo> => {
  if (!isExtensionPointMode || !data.extensionPoints) {
    return new Map();
  }

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
  const rightSideX = width - margin - extensionBoxWidth - LAYOUT_CONSTANTS.ARROW_SAFETY_MARGIN;

  // Calculate total height of all extension sections to center the extension point
  let totalExtensionsHeight = 0;
  if (data.extensions) {
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    let extensionSpacing = 70;
    if (options.showDescriptions) {
      extensionSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }
    const groupSpacing = getResponsiveGroupSpacing(height) + 30;

    Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
      const groupHeight = extensionIds.length * extensionSpacing + 50;
      totalExtensionsHeight += groupHeight + groupSpacing;
    });
  }

  const startY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30;
  const centerY = startY + totalExtensionsHeight / 2;

  // Position the extension point in the center of all extension sections
  data.extensionPoints.forEach((ep) => {
    positions.set(ep.id, {
      x: rightSideX,
      y: centerY,
      groupY: startY,
      groupHeight: totalExtensionsHeight,
    });
  });

  return positions;
};

/**
 * Calculate the minimum height required to display all graph content.
 *
 * This function determines how tall the SVG container needs to be to accommodate
 * all nodes, extension points, or exposed components without clipping. It considers
 * the visualization mode, number of items, spacing requirements, and whether
 * descriptions are enabled.
 *
 * @param data - Graph data containing all elements to be rendered
 * @param options - Panel options affecting spacing (showDescriptions)
 * @param width - Panel width (used for responsive calculations)
 * @param height - Panel height (used as minimum fallback)
 * @param isExposeMode - Whether in expose mode (affects layout calculations)
 * @returns Minimum height in pixels needed for the content
 */
export const calculateContentHeight = (
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  isExposeMode: boolean
): number => {
  const margin = getResponsiveMargin(width);
  let spacing = 70; // Fixed spacing to match component spacing

  if (options.showDescriptions) {
    spacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = getResponsiveGroupSpacing(height);
  let totalHeight = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 40; // Start with margin + header space

  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';

  if (isExtensionPointMode && data.extensions && data.extensions.length > 0) {
    // Group extensions by their providing plugin (app)
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
      const groupHeight = extensionIds.length * spacing + 50;
      totalHeight += groupHeight + groupSpacing;
    });
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
      const groupHeight = 80 + (componentIds.length - 1) * spacing + 60 + 12; // Header space + components + component height + bottom padding

      totalHeight += groupHeight + groupSpacing;
    });
  } else if (!isExposeMode && data.extensionPoints && data.extensionPoints.length > 0) {
    // Group extension points by their defining plugin to calculate total height
    const extensionPointGroups = new Map<string, string[]>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, []);
      }
      extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
    });

    Array.from(extensionPointGroups.entries()).forEach(([_, extensionPointIds]) => {
      const groupHeight = extensionPointIds.length * spacing + 5;
      totalHeight += groupHeight + groupSpacing;
    });
  } else {
    return height; // Use panel height as minimum if no content
  }

  return Math.max(totalHeight, height); // Use at least the panel height
};
