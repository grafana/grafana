import { reportInteraction } from '@grafana/runtime';

import { ContentKind, DiscoveryMethod, EventLocation, FEATURE_VARIANTS, SourceEntryPoint } from './constants';
import { isTemplateDashboardAssistantEnabled } from './utils/assistantHelpers';

const SCHEMA_VERSION = 1;

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
  itemClicked: async (
    properties: ItemClickedInteractionProperties & {
      /** Which button was clicked (template modal only): View template vs Customize with Assistant */
      action?: 'view_template' | 'assistant';
    }
  ) => {
    const isDashboardTemplatesAssistantEnabled = await isTemplateDashboardAssistantEnabled();

    reportDashboardLibraryInteraction('item_clicked', {
      ...properties,
      isDashboardTemplatesAssistantEnabled,
    });
  },
  loaded: async (properties: LoadedInteractionProperties) => {
    const isDashboardTemplatesAssistantEnabled = await isTemplateDashboardAssistantEnabled();
    reportDashboardLibraryInteraction('loaded', {
      ...properties,
      isDashboardTemplatesAssistantEnabled,
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
