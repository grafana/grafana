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
  typeHeaderY?: number; // Y position for type header
  extensionType?: string; // Extension type for this position
}

// Unified spacing constants for grouped boxes (boxes inside boxes)
const GROUPED_BOX_SPACING = {
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

/**
 * Unified positioning function for all grouped boxes.
 * This ensures consistent spacing across all views.
 */
function calculateUnifiedGroupedBoxPositions(
  currentGroupY: number,
  itemIds: string[],
  xPosition: number,
  typeHeaderSpacing = 0,
  boxHeights: number[] = []
): { positions: Map<string, PositionInfo>; groupHeight: number } {
  const positions = new Map<string, PositionInfo>();

  // If no box heights provided, use default two-line height for all items
  const heights =
    boxHeights.length > 0 ? boxHeights : new Array(itemIds.length).fill(GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES);

  // Calculate total height of all boxes plus gaps
  const totalBoxHeight = heights.reduce((sum, height) => sum + height, 0);
  const totalGapHeight = (itemIds.length - 1) * 8; // 8px gap between boxes

  // Calculate group height
  const groupHeight =
    25 + // Heading height
    GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX +
    typeHeaderSpacing + // Space for type header (if any)
    totalBoxHeight + // Sum of all box heights
    totalGapHeight + // 8px gap between boxes
    GROUPED_BOX_SPACING.BOTTOM_PADDING;

  // Calculate positions using the same logic as "Added links" view
  // The heading is at currentGroupY + 25, so first box should be at currentGroupY + 25 + HEADER_TO_FIRST_BOX
  let currentY = currentGroupY + 25 + GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX;

  // Add type header spacing if needed
  currentY += typeHeaderSpacing;

  let cumulativeHeight = 0;
  itemIds.forEach((itemId, index) => {
    const boxHeight = heights[index] || GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES;
    positions.set(itemId, {
      x: xPosition,
      y: currentY + cumulativeHeight,
      groupY: currentGroupY,
      groupHeight: groupHeight,
    });
    cumulativeHeight += boxHeight + 8; // Add box height + 8px gap
  });

  return { positions, groupHeight };
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

    // Component spacing - use unified inner box gap
    let componentSpacing = GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES + 8;
    componentSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;

    const groupSpacing = getResponsiveGroupSpacing(height) + 30; // Extra space for dotted lines
    let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30; // Match exposed component positioning

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

      // Calculate group height based on components only - consumers will align with component height
      const groupHeight =
        25 + // Heading height
        GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX +
        componentIds.length * GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES +
        (componentIds.length - 1) * GROUPED_BOX_SPACING.INNER_BOX_GAP + // 8px gap between boxes
        GROUPED_BOX_SPACING.BOTTOM_PADDING;
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
      // Each consumer should be positioned to align with the exposed components it's connected to
      const consumerPositions = new Map<string, number>();

      // First, find the position for each consumer based on the exposed components it's connected to
      data.exposedComponents?.forEach((comp) => {
        if (comp.providingPlugin === providingPlugin) {
          const componentIndex = componentIds.indexOf(comp.id);
          if (componentIndex !== -1) {
            // Consumers align with components, so use the same spacing
            const componentY =
              currentGroupY +
              25 + // Heading height
              GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX +
              28 + // Extra spacing
              componentIndex * (GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES + GROUPED_BOX_SPACING.INNER_BOX_GAP);
            comp.consumers.forEach((consumerId) => {
              // If this consumer is already positioned, use the average of its positions
              if (consumerPositions.has(consumerId)) {
                const existingY = consumerPositions.get(consumerId)!;
                consumerPositions.set(consumerId, (existingY + componentY) / 2);
              } else {
                consumerPositions.set(consumerId, componentY);
              }
            });
          }
        }
      });

      // Now position each consumer at its calculated position
      consumerPositions.forEach((consumerY, consumerId) => {
        const consumerNode = data.nodes.find((n) => n.id === consumerId);
        if (consumerNode) {
          result.push({
            ...consumerNode,
            id: `${consumerId}-at-${providingPlugin}`, // Unique ID for this section instance
            originalId: consumerId, // Keep track of original ID
            x: consumerX,
            y: consumerY,
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

  // Group extension points by their defining plugin, then by type
  const extensionPointGroups = new Map<string, Map<string, string[]>>();
  data.extensionPoints.forEach((ep) => {
    try {
      if (!ep.definingPlugin || !ep.id) {
        console.warn('Invalid extension point data:', ep);
        return;
      }

      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      let extensionType = ep.extensionType || 'link';

      // Validate extension type
      if (!['function', 'component', 'link'].includes(extensionType)) {
        console.warn(`Invalid extension type ${extensionType} for extension point ${ep.id}, defaulting to 'link'`);
        extensionType = 'link';
      }

      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
    } catch (error) {
      console.warn(`Error processing extension point ${ep.id}:`, error);
    }
  });

  // Sort extension points within each type group
  extensionPointGroups.forEach((typeGroups) => {
    typeGroups.forEach((extensionPointIds) => {
      extensionPointIds.sort();
    });
  });

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  let extensionPointSpacing = GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES + 8;
  if (options.showDescriptions) {
    extensionPointSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
  }

  const groupSpacing = 40;
  const typeHeaderSpacing =
    options.visualizationMode === 'addedlinks' || options.visualizationMode === 'add'
      ? 0
      : GROUPED_BOX_SPACING.TYPE_HEADER_SPACING; // No space for type headers in addedlinks and add modes
  const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
  const rightSideX = width - margin - extensionBoxWidth - LAYOUT_CONSTANTS.ARROW_SAFETY_MARGIN;

  let currentGroupY = margin + 110; // Increased from 90 to 110 for more distance from dotted line

  Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, typeGroups]) => {
    // Calculate total height for this plugin group
    let totalGroupHeight = 25 + GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX; // Start with heading height + header spacing
    const typeOrder = ['function', 'component', 'link'];

    typeOrder.forEach((type) => {
      const extensionPointIds = typeGroups.get(type);
      if (extensionPointIds && extensionPointIds.length > 0) {
        totalGroupHeight += typeHeaderSpacing; // Space for type header
        totalGroupHeight += extensionPointIds.length * GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES; // Box heights
        totalGroupHeight += (extensionPointIds.length - 1) * GROUPED_BOX_SPACING.INNER_BOX_GAP; // 8px gap between boxes
      }
    });
    totalGroupHeight += GROUPED_BOX_SPACING.BOTTOM_PADDING; // Add bottom padding

    // Position extension points by type using unified positioning
    let currentY = currentGroupY + 25 + GROUPED_BOX_SPACING.HEADER_TO_FIRST_BOX;

    typeOrder.forEach((type) => {
      const extensionPointIds = typeGroups.get(type);
      if (extensionPointIds && extensionPointIds.length > 0) {
        // Add space for type header
        currentY += typeHeaderSpacing;

        const typeHeaderY = typeHeaderSpacing > 0 ? currentY - typeHeaderSpacing : currentY;

        // Use unified positioning function for this type group
        // Extension points in Add/Added links mode are two-line boxes (title + ID), so use 60px height
        const extensionPointBoxHeights = extensionPointIds.map(() => GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES);
        const { positions: typePositions } = calculateUnifiedGroupedBoxPositions(
          currentGroupY,
          extensionPointIds,
          rightSideX,
          typeHeaderSpacing,
          extensionPointBoxHeights
        );

        // Add type-specific information to positions
        typePositions.forEach((pos, epId) => {
          positions.set(epId, {
            ...pos,
            typeHeaderY: typeHeaderY,
            extensionType: type,
          });
        });

        currentY +=
          extensionPointIds.length * (GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES + GROUPED_BOX_SPACING.INNER_BOX_GAP);
      }
    });

    currentGroupY += totalGroupHeight + groupSpacing;
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

    // Use unified positioning function for consistent spacing
    // Exposed components are two-line boxes (title + ID), so use 60px height
    const componentBoxHeights = componentIds.map(() => GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES);
    const { positions: componentPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentGroupY,
      componentIds,
      componentX,
      0, // No type header spacing in expose mode
      componentBoxHeights
    );

    // Add component positions to the main positions map
    componentPositions.forEach((pos, compId) => {
      positions.set(compId, pos);
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

  const groupSpacing = getResponsiveGroupSpacing(height) + 30;
  const leftSideX = margin + 20; // Position on the left side

  let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30;

  // Process each app section
  Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
    // Use unified positioning function for consistent spacing
    // Extensions are two-line boxes (title + ID), so use 60px height
    const extensionBoxHeights = extensionIds.map(() => GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES);
    const { positions: extensionPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentGroupY,
      extensionIds,
      leftSideX,
      0, // No type header spacing in extension point mode left side
      extensionBoxHeights
    );

    // Add extension positions to the main positions map
    extensionPositions.forEach((pos, extId) => {
      positions.set(extId, pos);
    });

    currentGroupY += groupHeight + groupSpacing;
  });

  return positions;
};

/**
 * Calculate positions for extension points in extension point mode visualization.
 *
 * Extension points are positioned on the right side of the visualization,
 * grouped by their defining plugin. Each group contains multiple extension
 * points with consistent spacing.
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

  // Group extension points by their defining plugin, then by type
  const extensionPointGroups = new Map<string, Map<string, string[]>>();
  data.extensionPoints.forEach((ep) => {
    if (!extensionPointGroups.has(ep.definingPlugin)) {
      extensionPointGroups.set(ep.definingPlugin, new Map());
    }
    const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
    const extensionType = ep.extensionType || 'link';
    if (!pluginGroup.has(extensionType)) {
      pluginGroup.set(extensionType, []);
    }
    pluginGroup.get(extensionType)!.push(ep.id);
  });

  // Sort extension points within each type group
  extensionPointGroups.forEach((typeGroups) => {
    typeGroups.forEach((extensionPointIds) => {
      extensionPointIds.sort();
    });
  });

  const positions = new Map<string, PositionInfo>();
  const margin = getResponsiveMargin(width);

  let extensionPointSpacing = GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES + 8;
  // Always add extra spacing for descriptions in extension point mode
  extensionPointSpacing += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;

  const groupSpacing = getResponsiveGroupSpacing(height) + 30;
  const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
  const rightSideX = width - margin - extensionBoxWidth - LAYOUT_CONSTANTS.ARROW_SAFETY_MARGIN;

  let currentGroupY = margin + LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET + 30;

  // Process each defining plugin section
  Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, typeGroups]) => {
    const typeHeaderSpacing = 0; // No type header spacing to match left side
    const typeOrder = ['function', 'component', 'link'];

    // Collect all extension point IDs for this plugin group
    const allExtensionPointIds: string[] = [];
    typeOrder.forEach((type) => {
      const extensionPointIds = typeGroups.get(type);
      if (extensionPointIds && extensionPointIds.length > 0) {
        allExtensionPointIds.push(...extensionPointIds);
      }
    });

    // Use unified positioning function for the entire plugin group
    // Extension points are two-line boxes (ID + description), so use 60px height
    const extensionPointBoxHeights = allExtensionPointIds.map(() => GROUPED_BOX_SPACING.BOX_HEIGHT_TWO_LINES);
    const { positions: allPositions, groupHeight } = calculateUnifiedGroupedBoxPositions(
      currentGroupY,
      allExtensionPointIds,
      rightSideX,
      typeHeaderSpacing,
      extensionPointBoxHeights
    );

    // Add type-specific information to positions
    typeOrder.forEach((type) => {
      const extensionPointIds = typeGroups.get(type);
      if (extensionPointIds && extensionPointIds.length > 0) {
        extensionPointIds.forEach((epId) => {
          const pos = allPositions.get(epId);
          if (pos) {
            positions.set(epId, {
              ...pos,
              typeHeaderY: pos.y - typeHeaderSpacing, // Calculate type header position
              extensionType: type,
            });
          }
        });
      }
    });

    currentGroupY += groupHeight + groupSpacing;
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
    // Group extensions by their providing plugin (app)
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    Array.from(extensionGroups.entries()).forEach(([providingPlugin, extensionIds]) => {
      const groupHeight = extensionIds.length * spacing + 30;
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

  return Math.max(totalHeight, height); // Use at least the panel height
};
