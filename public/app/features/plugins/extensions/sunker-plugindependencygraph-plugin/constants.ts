/**
 * Constants for the Plugin Dependency Graph Panel
 *
 * This file centralizes all configuration values, magic numbers, and constants
 * used throughout the plugin to improve maintainability.
 */

export const LAYOUT_CONSTANTS = {
  // Minimum margins and spacing
  MIN_MARGIN: 20,
  MIN_NODE_SPACING: 70,
  MIN_GROUP_SPACING: 40,

  // Margin calculations
  MARGIN_WIDTH_RATIO: 0.02, // 2% of width
  SPACING_HEIGHT_RATIO: 0.08, // 8% of height
  GROUP_SPACING_HEIGHT_RATIO: 0.05, // 5% of height

  // Node dimensions
  MIN_NODE_WIDTH: 180,
  MIN_NODE_HEIGHT: 50,
  NODE_WIDTH_RATIO: 0.15, // 15% of width
  NODE_HEIGHT_RATIO: 0.05, // 5% of height

  // Extension point dimensions
  EXTENSION_BOX_WIDTH: 280,
  EXTENSION_BOX_HEIGHT: 60,
  EXTENSION_BOX_HEIGHT_NO_TYPE: 40,

  // Component dimensions
  MIN_COMPONENT_WIDTH: 300,
  MIN_COMPONENT_HEIGHT: 55,
  COMPONENT_WIDTH_RATIO: 0.2, // 20% of width
  COMPONENT_HEIGHT_RATIO: 0.06, // 6% of height

  // Additional spacing when descriptions are shown
  DESCRIPTION_EXTRA_SPACING: 20,

  // Header positioning
  HEADER_Y_OFFSET: 25, // Main "Expose APIs" heading
  SUB_HEADER_Y_OFFSET: 60, // "Content provider/consumer" headings
  HEADER_LINE_Y_OFFSET: 70, // Dotted lines under sub-headers

  // Arrow positioning
  ARROW_OFFSET: 20,
  ARROW_SAFETY_MARGIN: 10,

  // Consumer positioning
  RIGHT_MARGIN_WIDTH_RATIO: 0.04, // 4% of width
  MIN_RIGHT_MARGIN: 40,
} as const;

export const VISUAL_CONSTANTS = {
  // Border radius
  NODE_BORDER_RADIUS: 8,
  EXTENSION_BORDER_RADIUS: 6,
  GROUP_BORDER_RADIUS: 12,

  // Stroke widths
  DEFAULT_STROKE_WIDTH: 2,
  SELECTED_STROKE_WIDTH: 3,
  THICK_STROKE_WIDTH: 4,
  VERY_THICK_STROKE_WIDTH: 5,

  // Arrow marker dimensions
  ARROW_WIDTH: 12,
  ARROW_HEIGHT: 9,
  ARROW_REF_X: 9,
  ARROW_REF_Y: 4.5,

  // Opacity levels
  SELECTED_OPACITY: 1,
  UNSELECTED_OPACITY: 0.3,

  // Drop shadow offsets
  SHADOW_OFFSET_X: 0,
  SHADOW_OFFSET_Y: 4,
  SHADOW_BLUR: 8,
  SHADOW_OPACITY: 0.15,
  ENHANCED_SHADOW_BLUR: 12,
} as const;

export const TYPOGRAPHY_CONSTANTS = {
  // Font sizes
  MAIN_HEADER_SIZE: '18px',
  SECTION_HEADER_SIZE: '16px',
  PLUGIN_LABEL_SIZE: 14,
  EXTENSION_LABEL_SIZE: 12,
  TYPE_BADGE_SIZE: 10,
  DESCRIPTION_SIZE: 10,
  API_LABEL_SIZE: 10,

  // Font weights
  BOLD_WEIGHT: 700,
  SEMI_BOLD_WEIGHT: 600,
  MEDIUM_WEIGHT: 500,

  // Font families
  MONOSPACE_FAMILY: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
} as const;

export const COLOR_DEFAULTS = {
  // Extension type colors
  LINK_EXTENSION: '#37872d',
  COMPONENT_EXTENSION: '#ff9900',
  FUNCTION_EXTENSION: '#e02f44',
} as const;

export const INTERACTION_CONSTANTS = {
  // Transition durations
  DEFAULT_TRANSITION: '0.2s ease',

  // Hover effects
  HOVER_BRIGHTNESS: 1.05,
  LINK_HOVER_BRIGHTNESS: 1.2,
  HIGHLIGHTED_LINK_BRIGHTNESS: 1.1,

  // Minimum spacing between consumer nodes
  MIN_CONSUMER_SPACING: 80,
} as const;

export const MODE_LABELS = {
  ADD_MODE: 'Add APIs',
  EXPOSE_MODE: 'Expose APIs',
  CONTENT_PROVIDER: 'Content provider',
  CONTENT_CONSUMER: 'Content consumer',
  COMPONENTS: 'Components',
} as const;

export const DISPLAY_NAMES = {
  GRAFANA_CORE: 'grafana core',
  GRAFANA_CORE_DISPLAY: 'Grafana Core',
} as const;

export const PLUGIN_TYPES = {
  APP: 'app' as const,
  PANEL: 'panel' as const,
  DATASOURCE: 'datasource' as const,
} as const;

/**
 * Responsive calculation helpers
 */
export const getResponsiveMargin = (width: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_MARGIN, width * LAYOUT_CONSTANTS.MARGIN_WIDTH_RATIO);

export const getResponsiveNodeSpacing = (height: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_NODE_SPACING, height * LAYOUT_CONSTANTS.SPACING_HEIGHT_RATIO);

export const getResponsiveGroupSpacing = (height: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_GROUP_SPACING, height * LAYOUT_CONSTANTS.GROUP_SPACING_HEIGHT_RATIO);

export const getResponsiveNodeWidth = (width: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_NODE_WIDTH, width * LAYOUT_CONSTANTS.NODE_WIDTH_RATIO);

export const getResponsiveNodeHeight = (height: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_NODE_HEIGHT, height * LAYOUT_CONSTANTS.NODE_HEIGHT_RATIO);

export const getResponsiveComponentWidth = (width: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_COMPONENT_WIDTH, width * LAYOUT_CONSTANTS.COMPONENT_WIDTH_RATIO);

export const getResponsiveComponentHeight = (height: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_COMPONENT_HEIGHT, height * LAYOUT_CONSTANTS.COMPONENT_HEIGHT_RATIO);

export const getRightMargin = (width: number): number =>
  Math.max(LAYOUT_CONSTANTS.MIN_RIGHT_MARGIN, width * LAYOUT_CONSTANTS.RIGHT_MARGIN_WIDTH_RATIO);
