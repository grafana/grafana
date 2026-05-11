/**
 * Where in the UI the dashboard library interaction occurs.
 * Used in tracking events to distinguish between modal, browse page, etc.
 */
export const EVENT_LOCATIONS = {
  MODAL_VIEW: 'suggested_dashboards_modal',
  BROWSE_DASHBOARDS_PAGE: 'browse_dashboards_page',
  DASHBOARD_PAGE_SUGGESTED_DASHBOARDS_BANNER: 'dashboard_page_suggested_dashboards_banner',
} as const;

/**
 * The type of dashboard content being interacted with.
 * Used in tracking events to distinguish between provisioned, community, and template dashboards.
 * SUGGESTED_DASHBOARDS is used in `entry_point_clicked` events to identify the feature area.
 */
export const CONTENT_KINDS = {
  DATASOURCE_DASHBOARD: 'datasource_dashboard',
  COMMUNITY_DASHBOARD: 'community_dashboard',
  TEMPLATE_DASHBOARD: 'template_dashboard',
  SUGGESTED_DASHBOARDS: 'suggested_dashboards',
} as const;

/**
 * Entry points for template dashboards (browse page, command palette, assistant, etc.).
 */
export const TemplateDashboardSourceEntryPoint = {
  QUICK_ADD_BUTTON: 'quick_add_button',
  COMMAND_PALETTE: 'command_palette',
  BROWSE_DASHBOARDS_PAGE: 'browse_dashboards_page_create_new_button',
  ASSISTANT_BUTTON: 'assistant_button',
} as const;

/**
 * Entry points for suggested dashboards — each value identifies the specific
 * button or banner that opened the suggested dashboards modal.
 */
const SuggestedDashboardSourceEntryPoint = {
  DATASOURCE_PAGE_BUILD_BUTTON: 'datasource_page_build_button',
  DATASOURCE_PAGE_SUCCESS_BANNER: 'datasource_page_success_banner',
  DATASOURCE_LIST_BUILD_BUTTON: 'datasource_list_build_button',
  DASHBOARD_PAGE_SUGGESTED_DASHBOARDS_BANNER: 'dashboard_page_suggested_dashboards_banner',
} as const;

/**
 * Combined source entry points for all dashboard library features.
 * Sent in tracking events to identify which UI element triggered the interaction.
 */
export const SOURCE_ENTRY_POINTS = {
  ...SuggestedDashboardSourceEntryPoint,
  ...TemplateDashboardSourceEntryPoint,
} as const;

/**
 * How the user found the dashboard they interacted with: via search or browsing.
 */
export const DISCOVERY_METHODS = {
  SEARCH: 'search',
  BROWSE: 'browse',
} as const;

/**
 * Creation origin values stamped on dashboards created through the library.
 * Used for downstream attribution (e.g. analytics, feature usage tracking).
 */
export const CREATION_ORIGINS = {
  DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD: 'dashboard_library_datasource_dashboard',
  DASHBOARD_LIBRARY_COMMUNITY_DASHBOARD: 'dashboard_library_community_dashboard',
  DASHBOARD_LIBRARY_TEMPLATE_DASHBOARD: 'dashboard_library_template_dashboard',
} as const;

export type EventLocation = (typeof EVENT_LOCATIONS)[keyof typeof EVENT_LOCATIONS];
export type ContentKind = (typeof CONTENT_KINDS)[keyof typeof CONTENT_KINDS];
export type SourceEntryPoint = (typeof SOURCE_ENTRY_POINTS)[keyof typeof SOURCE_ENTRY_POINTS];
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[keyof typeof DISCOVERY_METHODS];
export type CreationOrigin = (typeof CREATION_ORIGINS)[keyof typeof CREATION_ORIGINS];

/** Number of dashboards shown per page in the suggested dashboards list. */
export const PAGE_SIZE = 6;
