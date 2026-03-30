import { EventProperty } from '@grafana/runtime/internal';

import type { ContentKind, SourceEntryPoint, EventLocation, DiscoveryMethod } from '../constants';

export interface LoadedProperties extends EventProperty {
  numberOfItems: number;
  contentKinds: ContentKind[];
  datasourceTypes: string[];
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  isDashboardAssistantEnabled?: boolean;
}

export interface ItemClickedProperties extends EventProperty {
  contentKind: ContentKind;
  datasourceTypes: string[];
  libraryItemId: string;
  libraryItemTitle: string;
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  discoveryMethod: DiscoveryMethod;
  isDashboardAssistantEnabled?: boolean;
}

export interface SearchPerformedProperties extends EventProperty {
  datasourceTypes: string[];
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  hasResults: boolean;
  resultCount: number;
}

export interface MappingFormShownProperties extends EventProperty {
  contentKind: ContentKind;
  datasourceTypes: string[];
  libraryItemId: string;
  libraryItemTitle: string;
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  unmappedDsInputsCount: number;
  constantInputsCount: number;
}

export interface MappingFormCompletedProperties extends EventProperty {
  contentKind: ContentKind;
  datasourceTypes: string[];
  libraryItemId: string;
  libraryItemTitle: string;
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
  userMappedCount: number;
  autoMappedCount: number;
}

export interface EntryPointClickedProperties extends EventProperty {
  entryPoint: SourceEntryPoint;
  contentKind: ContentKind;
}

export interface CompatibilityCheckTriggeredProperties extends EventProperty {
  dashboardId: string;
  dashboardTitle: string;
  datasourceType: string;
  triggerMethod: 'manual' | 'auto_initial_load';
  eventLocation: EventLocation;
}

export interface CompatibilityCheckCompletedProperties extends EventProperty {
  dashboardId: string;
  dashboardTitle: string;
  datasourceType: string;
  score: number;
  metricsFound: number;
  metricsTotal: number;
  triggerMethod: 'manual' | 'auto_initial_load';
  eventLocation: EventLocation;
}
