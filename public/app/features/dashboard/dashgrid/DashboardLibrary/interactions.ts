import { reportInteraction } from '@grafana/runtime';

const SCHEMA_VERSION = 1;

export type ContentKind = 'datasource_dashboard' | 'community_dashboard';
// in future this could also include "template_dashboard" if/when items become templates
// | 'template_dashboard';

export type SourceEntryPoint = 'datasource_page';
// possible future flows onboarding, create-dashboard, empty states
// | 'create_dashboard' | 'empty_state';

export type EventLocation =
  | 'empty_dashboard'
  | 'suggested_dashboards_modal_provisioned_tab'
  | 'suggested_dashboards_modal_community_tab';

// Constant values for tracking events
export const EVENT_LOCATIONS = {
  EMPTY_DASHBOARD: 'empty_dashboard',
  MODAL_PROVISIONED_TAB: 'suggested_dashboards_modal_provisioned_tab',
  MODAL_COMMUNITY_TAB: 'suggested_dashboards_modal_community_tab',
} as const satisfies Record<string, EventLocation>;

export const CONTENT_KINDS = {
  DATASOURCE_DASHBOARD: 'datasource_dashboard',
  COMMUNITY_DASHBOARD: 'community_dashboard',
} as const satisfies Record<string, ContentKind>;

export const SOURCE_ENTRY_POINTS = {
  DATASOURCE_PAGE: 'datasource_page',
} as const satisfies Record<string, SourceEntryPoint>;

export const DashboardLibraryInteractions = {
  loaded: (properties: {
    numberOfItems: number;
    contentKinds: ContentKind[];
    datasourceTypes: string[];
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
  }) => {
    reportDashboardLibraryInteraction('loaded', properties);
  },
  searchPerformed: (properties: {
    datasourceTypes: string[];
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
    hasResults: boolean;
    resultCount: number;
  }) => {
    reportDashboardLibraryInteraction('search_performed', properties);
  },
  itemClicked: (properties: {
    contentKind: ContentKind;
    datasourceTypes: string[];
    libraryItemId: string;
    libraryItemTitle: string;
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
    clickedAt: number; // Timestamp in milliseconds for TTV calculation
    discoveryMethod: 'search' | 'browse';
  }) => {
    reportDashboardLibraryInteraction('item_clicked', properties);
  },
  mappingFormShown: (properties: {
    contentKind: ContentKind;
    datasourceTypes: string[];
    libraryItemId: string;
    libraryItemTitle: string;
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
    unmappedInputsCount: number;
    constantInputsCount: number;
  }) => {
    reportDashboardLibraryInteraction('mapping_form_shown', properties);
  },
  mappingFormCompleted: (properties: {
    contentKind: ContentKind;
    datasourceTypes: string[];
    libraryItemId: string;
    libraryItemTitle: string;
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
    userMappedCount: number;
    autoMappedCount: number;
  }) => {
    reportDashboardLibraryInteraction('mapping_form_completed', properties);
  },
};

const reportDashboardLibraryInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_dashboard_library_${name}`, { ...properties, schema_version: SCHEMA_VERSION });
};
