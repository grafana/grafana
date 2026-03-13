import { createInteractionEvent } from '@grafana/runtime/internal';

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

const newDashboardLibraryInteraction = createInteractionEvent('grafana', 'dashboard_library');

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
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('suggested_item_clicked'),
  loaded: newDashboardLibraryInteraction<LoadedProperties>('suggested_loaded'),
};

export const NewBasicProvisionedDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('basic_provisioned_item_clicked'),
  loaded: newDashboardLibraryInteraction<LoadedProperties>('basic_provisioned_loaded'),
};
