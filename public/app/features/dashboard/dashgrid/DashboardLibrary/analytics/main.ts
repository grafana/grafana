import { defineFeatureEvents } from '@grafana/runtime/internal';

import { FEATURE_VARIANTS } from '../constants';

import {
  CompatibilityCheckCompletedProperties,
  CompatibilityCheckTriggeredProperties,
  EntryPointClickedProperties,
  ItemClickedProperties,
  LoadedProperties,
  MappingFormCompletedProperties,
  MappingFormShownProperties,
  SearchPerformedProperties,
} from './types';

const SCHEMA_VERSION = 1;

const newDashboardLibraryInteraction = defineFeatureEvents('grafana', 'dashboard_library', {
  schema_version: SCHEMA_VERSION,
});

/**
 * Analytics events for the Dashboard Library feature.
 * @owner grafana-dashboards
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
  /** Fired when a dashboard compatibility check finishes and results are ready for display. */
  compatibilityCheckCompleted: newDashboardLibraryInteraction<CompatibilityCheckCompletedProperties>(
    'compatibility_check_completed'
  ),
};

/**
 * Dashboard Library events scoped to the Template Dashboards variant.
 * @owner grafana-dashboards
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
 * Automatically injects `featureVariant: SUGGESTED_DASHBOARDS` into every event.
 * @owner grafana-dashboards
 */
export const NewSuggestedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  /** Fired when the user selects an item in the Suggested Dashboards view. */
  itemClicked: (props: ItemClickedProperties) =>
    newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked')({
      ...props,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    }),
  /** Fired when the Suggested Dashboards view finishes loading. */
  loaded: (props: LoadedProperties) =>
    newDashboardLibraryInteraction<LoadedProperties>('loaded')({
      ...props,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    }),
};

/**
 * Dashboard Library events scoped to the Basic Provisioned Dashboards variant.
 * Automatically injects `featureVariant: BASIC_PROVISIONED_DASHBOARDS` into every event.
 * @owner grafana-dashboards
 */
export const NewBasicProvisionedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  /** Fired when the user selects an item in the Basic Provisioned Dashboards view. */
  itemClicked: (props: ItemClickedProperties) =>
    newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked')({
      ...props,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    }),
  /** Fired when the Basic Provisioned Dashboards view finishes loading. */
  loaded: (props: LoadedProperties) =>
    newDashboardLibraryInteraction<LoadedProperties>('loaded')({
      ...props,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    }),
};
