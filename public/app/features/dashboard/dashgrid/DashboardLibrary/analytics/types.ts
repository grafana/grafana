import { type EventProperty } from '@grafana/runtime/internal';

import type { ContentKind, SourceEntryPoint, EventLocation, DiscoveryMethod } from '../constants';

export interface LoadedProperties extends EventProperty {
  /** Total number of items visible in the library at load time. */
  numberOfItems: number;
  /** The categories of content (e.g. panels, dashboards) present in the loaded set. */
  contentKinds: ContentKind[];
  /** Plugin IDs of data sources referenced by the loaded items. */
  datasourceTypes: string[];
  /** The UI surface or navigation path the user came from to reach the library. */
  sourceEntryPoint: SourceEntryPoint;
  /** The specific UI location within the product where the event fired. */
  eventLocation: EventLocation;
  /** Whether the Dashboard Assistant AI feature was enabled at the time of the event. */
  isDashboardAssistantEnabled?: boolean;
}

export interface ItemClickedProperties extends EventProperty {
  /** The category of content the user clicked (e.g. panel, dashboard). */
  contentKind: ContentKind;
  /** Plugin IDs of data sources used by the clicked item. */
  datasourceTypes: string[];
  /** Unique identifier of the library item. */
  libraryItemId: string;
  /** Display title of the library item as shown in the UI. */
  libraryItemTitle: string;
  /** The UI surface the user came from when they opened the library. */
  sourceEntryPoint: SourceEntryPoint;
  /** The specific UI location within the product where the click occurred. */
  eventLocation: EventLocation;
  /** How the user found the item — e.g. via search, browsing, or a suggestion. */
  discoveryMethod: DiscoveryMethod;
  /** Whether the Dashboard Assistant AI feature was enabled at the time of the event. */
  isDashboardAssistantEnabled?: boolean;
}

export interface SearchPerformedProperties extends EventProperty {
  /** Plugin IDs of data sources used as search filters. */
  datasourceTypes: string[];
  /** The UI surface the user came from when they opened the library. */
  sourceEntryPoint: SourceEntryPoint;
  /** The specific UI location within the product where the search was performed. */
  eventLocation: EventLocation;
  /** Whether the query returned at least one result. */
  hasResults: boolean;
  /** Number of items matching the query. */
  resultCount: number;
}

export interface MappingFormShownProperties extends EventProperty {
  /** The category of content being imported. */
  contentKind: ContentKind;
  /** Plugin IDs of data sources referenced by the item being imported. */
  datasourceTypes: string[];
  /** Unique identifier of the item being imported. */
  libraryItemId: string;
  /** Display title of the item being imported. */
  libraryItemTitle: string;
  /** The UI surface the user came from when they opened the library. */
  sourceEntryPoint: SourceEntryPoint;
  /** The specific UI location within the product where the form appeared. */
  eventLocation: EventLocation;
  /** Number of data source inputs that could not be resolved automatically and require manual mapping. */
  unmappedDsInputsCount: number;
  /** Number of constant/template-variable inputs present in the item. */
  constantInputsCount: number;
}

export interface MappingFormCompletedProperties extends EventProperty {
  /** The category of content being imported. */
  contentKind: ContentKind;
  /** Plugin IDs of data sources referenced by the item. */
  datasourceTypes: string[];
  /** Unique identifier of the item being imported. */
  libraryItemId: string;
  /** Display title of the item being imported. */
  libraryItemTitle: string;
  /** The UI surface the user came from when they opened the library. */
  sourceEntryPoint: SourceEntryPoint;
  /** The specific UI location within the product where the form was completed. */
  eventLocation: EventLocation;
  /** Number of data sources the user mapped manually. */
  userMappedCount: number;
  /** Number of data sources resolved automatically without user input. */
  autoMappedCount: number;
}

export interface EntryPointClickedProperties extends EventProperty {
  /** The specific entry point (button, link, etc.) the user interacted with. */
  entryPoint: SourceEntryPoint;
  /** The category of content accessible through this entry point. */
  contentKind: ContentKind;
}

export interface CompatibilityCheckTriggeredProperties extends EventProperty {
  /** Unique identifier of the dashboard being checked. */
  dashboardId: string;
  /** Display title of the dashboard being checked. */
  dashboardTitle: string;
  /** Plugin ID of the data source being evaluated for compatibility. */
  datasourceType: string;
  /** Whether the check was started by the user or automatically on page load. */
  triggerMethod: 'manual' | 'auto_initial_load';
  /** The specific UI location within the product where the check was triggered. */
  eventLocation: EventLocation;
}

export interface CompatibilityCheckCompletedProperties extends EventProperty {
  /** Unique identifier of the dashboard that was checked. */
  dashboardId: string;
  /** Display title of the dashboard that was checked. */
  dashboardTitle: string;
  /** Plugin ID of the data source that was evaluated. */
  datasourceType: string;
  /** Compatibility score (0–100) indicating how well the dashboard works with the data source. */
  score: number;
  /** Number of metrics from the dashboard that were found in the data source. */
  metricsFound: number;
  /** Total number of metrics in the dashboard that were checked. */
  metricsTotal: number;
  /** Whether the check was started by the user or automatically on page load. */
  triggerMethod: 'manual' | 'auto_initial_load';
  /** The specific UI location within the product where the check was completed. */
  eventLocation: EventLocation;
}
