import { reportInteraction } from '@grafana/runtime';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

const SCHEMA_VERSION = 1;

// Constant values for tracking events
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
  // in future this could also include "TEMPLATE_DASHBOARD" if/when items become templates
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
  // possible future flows: CREATE_DASHBOARD, EMPTY_STATE
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

// Which experiment variant the user saw on the empty dashboard page:
// - SUGGESTED_DASHBOARDS: inline cards with provisioned + community dashboards (suggestedDashboards + dashboardLibrary flags)
// - BASIC_PROVISIONED_DASHBOARDS: provisioned dashboards only (dashboardLibrary flag, no suggestedDashboards)
export const FEATURE_VARIANTS = {
  SUGGESTED_DASHBOARDS: 'suggested_dashboards',
  BASIC_PROVISIONED_DASHBOARDS: 'basic_provisioned_dashboards',
} as const;

// Derive types from constant maps for single source of truth
export type EventLocation = (typeof EVENT_LOCATIONS)[keyof typeof EVENT_LOCATIONS];
export type ContentKind = (typeof CONTENT_KINDS)[keyof typeof CONTENT_KINDS];
export type SourceEntryPoint = (typeof SOURCE_ENTRY_POINTS)[keyof typeof SOURCE_ENTRY_POINTS];
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[keyof typeof DISCOVERY_METHODS];
export type CreationOrigin = (typeof CREATION_ORIGINS)[keyof typeof CREATION_ORIGINS];
export type FeatureVariant = (typeof FEATURE_VARIANTS)[keyof typeof FEATURE_VARIANTS];

type LoadedInteractionProperties = {
  numberOfItems: number;
  contentKinds: ContentKind[];
  datasourceTypes: string[];
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
};

type ItemClickedInteractionProperties = {
  contentKind: ContentKind;
  datasourceTypes: string[];
  libraryItemId: string;
  libraryItemTitle: string;
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  discoveryMethod: DiscoveryMethod;
};

export const DashboardLibraryInteractions = {
  loaded: (properties: LoadedInteractionProperties) => {
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
  itemClicked: (properties: ItemClickedInteractionProperties) => {
    reportDashboardLibraryInteraction('item_clicked', properties);
  },
  mappingFormShown: (properties: {
    contentKind: ContentKind;
    datasourceTypes: string[];
    libraryItemId: string;
    libraryItemTitle: string;
    sourceEntryPoint: SourceEntryPoint;
    eventLocation: EventLocation;
    unmappedDsInputsCount: number;
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
  entryPointClicked: (properties: { entryPoint: SourceEntryPoint; contentKind: ContentKind }) => {
    reportDashboardLibraryInteraction('entry_point_clicked', properties);
  },

  compatibilityCheckTriggered: (properties: {
    dashboardId: string;
    dashboardTitle: string;
    datasourceType: string;
    triggerMethod: 'manual' | 'auto_initial_load';
    eventLocation: EventLocation;
  }) => {
    reportDashboardLibraryInteraction('compatibility_check_triggered', properties);
  },

  compatibilityCheckCompleted: (properties: {
    dashboardId: string;
    dashboardTitle: string;
    datasourceType: string;
    score: number;
    metricsFound: number;
    metricsTotal: number;
    triggerMethod: 'manual' | 'auto_initial_load';
    eventLocation: EventLocation;
  }) => {
    reportDashboardLibraryInteraction('compatibility_check_completed', properties);
  },
};

export const TemplateDashboardInteractions = {
  ...DashboardLibraryInteractions,
  itemClicked: (
    properties: ItemClickedInteractionProperties & {
      /** Which button was clicked (template modal only): View template vs Customize with Assistant */
      action?: 'view_template' | 'assistant';
    }
  ) => {
    const isDashboardTemplatesAssistantButtonEnabled = getFeatureFlagClient().getBooleanValue(
      'dashboardTemplatesAssistantButton',
      false
    );
    const isDashboardTemplatesAssistantToolEnabled = getFeatureFlagClient().getBooleanValue(
      'assistant.frontend.tools.dashboardTemplates',
      false
    );

    reportDashboardLibraryInteraction('item_clicked', {
      ...properties,
      isDashboardTemplatesAssistantEnabled:
        isDashboardTemplatesAssistantButtonEnabled && isDashboardTemplatesAssistantToolEnabled,
    });
  },
  loaded: (properties: LoadedInteractionProperties) => {
    const isDashboardTemplatesAssistantButtonEnabled = getFeatureFlagClient().getBooleanValue(
      'dashboardTemplatesAssistantButton',
      false
    );
    const isDashboardTemplatesAssistantToolEnabled = getFeatureFlagClient().getBooleanValue(
      'assistant.frontend.tools.dashboardTemplates',
      false
    );

    reportDashboardLibraryInteraction('loaded', {
      ...properties,
      isDashboardTemplatesAssistantEnabled:
        isDashboardTemplatesAssistantButtonEnabled && isDashboardTemplatesAssistantToolEnabled,
    });
  },
};

export const SuggestedDashboardInteractions = {
  ...DashboardLibraryInteractions,
  loaded: (properties: LoadedInteractionProperties) => {
    reportDashboardLibraryInteraction('loaded', {
      ...properties,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    });
  },
  itemClicked: (properties: ItemClickedInteractionProperties) => {
    reportDashboardLibraryInteraction('item_clicked', {
      ...properties,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    });
  },
};

export const BasicProvisionedDashboardInteractions = {
  ...DashboardLibraryInteractions,
  loaded: (properties: LoadedInteractionProperties) => {
    reportDashboardLibraryInteraction('loaded', {
      ...properties,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    });
  },
  itemClicked: (properties: ItemClickedInteractionProperties) => {
    reportDashboardLibraryInteraction('item_clicked', {
      ...properties,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    });
  },
};

const reportDashboardLibraryInteraction = (name: string, properties?: Record<string, unknown>) => {
  reportInteraction(`grafana_dashboard_library_${name}`, { ...properties, schema_version: SCHEMA_VERSION });
};
