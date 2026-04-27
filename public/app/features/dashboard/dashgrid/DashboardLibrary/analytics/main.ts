import { defineFeatureEvents } from '@grafana/runtime/internal';

import {
  type CompatibilityCheckCompletedProperties,
  type CompatibilityCheckTriggeredProperties,
  type CreateFromScratchClickedProperties,
  type EntryPointClickedProperties,
  type ItemClickedProperties,
  type LoadedProperties,
  type MappingFormCompletedProperties,
  type MappingFormShownProperties,
  type SearchPerformedProperties,
} from './types';

const SCHEMA_VERSION = 1;

const newDashboardLibraryInteraction = defineFeatureEvents('grafana', 'dashboard_library', {
  /** Version of the event schema, used to handle breaking changes in the properties contract. */
  schema_version: SCHEMA_VERSION,
});

/**
 * Analytics events for the Dashboard Library feature.
 */

export const NewDashboardLibraryInteractions = {
  /** Fired when the library panel finishes rendering and its items are visible. */
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
  /** Fired when the user submits or modifies a search query within the library. */
  searchPerformed: newDashboardLibraryInteraction<SearchPerformedProperties>('search_performed'),
  /** Fired when the user selects an item from the library list. */
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
  /** Fired when the datasource mapping form is displayed during an import flow. */
  mappingFormShown: newDashboardLibraryInteraction<MappingFormShownProperties>('mapping_form_shown'),
  /** Fired when the user submits the datasource mapping form to complete an import. */
  mappingFormCompleted: newDashboardLibraryInteraction<MappingFormCompletedProperties>('mapping_form_completed'),
  /** Fired when the user clicks a UI entry point to open the library. */
  entryPointClicked: newDashboardLibraryInteraction<EntryPointClickedProperties>('entry_point_clicked'),
  /** Fired when a dashboard compatibility check is initiated, either manually or on initial load. */
  compatibilityCheckTriggered: newDashboardLibraryInteraction<CompatibilityCheckTriggeredProperties>(
    'compatibility_check_triggered'
  ),
  /** Fired when the user chooses to start a new dashboard from scratch instead of using a library item. */
  createFromScratchClicked:
    newDashboardLibraryInteraction<CreateFromScratchClickedProperties>('create_from_scratch_clicked'),
  /** Fired when a dashboard compatibility check finishes and results are ready for display. */
  compatibilityCheckCompleted: newDashboardLibraryInteraction<CompatibilityCheckCompletedProperties>(
    'compatibility_check_completed'
  ),
};

/**
 * Dashboard Library events scoped to the Template Dashboards variant.
 */
export const NewTemplateDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  /** Fired when the user selects an item in the Template Dashboards view. */
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
  /** Fired when the Template Dashboards view finishes loading. */
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
};

/**
 * Dashboard Library events scoped to the Suggested Dashboards variant.
 */
export const NewSuggestedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  /** Fired when the user selects an item in the Suggested Dashboards view. */
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
  /** Fired when the Suggested Dashboards view finishes loading. */
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
};
