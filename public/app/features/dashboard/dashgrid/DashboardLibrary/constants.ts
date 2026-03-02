export const EVENT_LOCATIONS = {
  EMPTY_DASHBOARD: 'empty_dashboard',
  MODAL_PROVISIONED_TAB: 'suggested_dashboards_modal_provisioned_tab',
  MODAL_COMMUNITY_TAB: 'suggested_dashboards_modal_community_tab',
  BROWSE_DASHBOARDS_PAGE: 'browse_dashboards_page',
  COMMUNITY_DASHBOARD_LOADED: 'community_dashboard_loaded',
} as const;

export const CONTENT_KINDS = {
  DATASOURCE_DASHBOARD: 'datasource_dashboard',
  COMMUNITY_DASHBOARD: 'community_dashboard',
  TEMPLATE_DASHBOARD: 'template_dashboard',
} as const;

export const TemplateDashboardSourceEntryPoint = {
  QUICK_ADD_BUTTON: 'quick_add_button',
  COMMAND_PALETTE: 'command_palette',
  BROWSE_DASHBOARDS_PAGE: 'browse_dashboards_page_create_new_button',
  ASSISTANT_BUTTON: 'assistant_button',
} as const;

export const SOURCE_ENTRY_POINTS = {
  DATASOURCE_PAGE: 'datasource_page',
  ...TemplateDashboardSourceEntryPoint,
} as const;

export const DISCOVERY_METHODS = {
  SEARCH: 'search',
  BROWSE: 'browse',
} as const;

export const CREATION_ORIGINS = {
  DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD: 'dashboard_library_datasource_dashboard',
  DASHBOARD_LIBRARY_COMMUNITY_DASHBOARD: 'dashboard_library_community_dashboard',
  DASHBOARD_LIBRARY_TEMPLATE_DASHBOARD: 'dashboard_library_template_dashboard',
} as const;

export const FEATURE_VARIANTS = {
  SUGGESTED_DASHBOARDS: 'suggested_dashboards',
  BASIC_PROVISIONED_DASHBOARDS: 'basic_provisioned_dashboards',
} as const;

export type EventLocation = (typeof EVENT_LOCATIONS)[keyof typeof EVENT_LOCATIONS];
export type ContentKind = (typeof CONTENT_KINDS)[keyof typeof CONTENT_KINDS];
export type SourceEntryPoint = (typeof SOURCE_ENTRY_POINTS)[keyof typeof SOURCE_ENTRY_POINTS];
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[keyof typeof DISCOVERY_METHODS];
export type CreationOrigin = (typeof CREATION_ORIGINS)[keyof typeof CREATION_ORIGINS];
export type FeatureVariant = (typeof FEATURE_VARIANTS)[keyof typeof FEATURE_VARIANTS];
