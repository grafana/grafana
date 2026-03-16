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

export const NewDashboardLibraryInteractions = {
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
  searchPerformed: newDashboardLibraryInteraction<SearchPerformedProperties>('search_performed'),
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
  mappingFormShown: newDashboardLibraryInteraction<MappingFormShownProperties>('mapping_form_shown'),
  mappingFormCompleted: newDashboardLibraryInteraction<MappingFormCompletedProperties>('mapping_form_completed'),
  entryPointClicked: newDashboardLibraryInteraction<EntryPointClickedProperties>('entry_point_clicked'),
  compatibilityCheckTriggered: newDashboardLibraryInteraction<CompatibilityCheckTriggeredProperties>(
    'compatibility_check_triggered'
  ),
  compatibilityCheckCompleted: newDashboardLibraryInteraction<CompatibilityCheckCompletedProperties>(
    'compatibility_check_completed'
  ),
};

export const NewTemplateDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
};

export const NewSuggestedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: (props: ItemClickedProperties) =>
    newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked')({
      ...props,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    }),
  loaded: (props: LoadedProperties) =>
    newDashboardLibraryInteraction<LoadedProperties>('loaded')({
      ...props,
      featureVariant: FEATURE_VARIANTS.SUGGESTED_DASHBOARDS,
    }),
};

export const NewBasicProvisionedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: (props: ItemClickedProperties) =>
    newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked')({
      ...props,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    }),
  loaded: (props: LoadedProperties) =>
    newDashboardLibraryInteraction<LoadedProperties>('loaded')({
      ...props,
      featureVariant: FEATURE_VARIANTS.BASIC_PROVISIONED_DASHBOARDS,
    }),
};
