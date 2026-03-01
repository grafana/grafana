import { createInteractionEvent } from '@grafana/runtime/internal';

const newDashboardLibraryInteraction = createInteractionEvent('grafana', 'dashboard_library');

export const NewDashboardLibraryInteractions = {
  loaded: newDashboardLibraryInteraction('loaded'),
  searchPerformed: newDashboardLibraryInteraction('search_performed'),
  itemClicked: newDashboardLibraryInteraction('item_clicked'),
  mappingFormShown: newDashboardLibraryInteraction('mapping_form_shown'),
  mappingFormCompleted: newDashboardLibraryInteraction('mapping_form_completed'),
  entryPointClicked: newDashboardLibraryInteraction('entry_point_clicked'),
  compatibilityCheckTriggered: newDashboardLibraryInteraction('compatibility_check_triggered'),
  compatibilityCheckCompleted: newDashboardLibraryInteraction('compatibility_check_completed'),
};

export const NewTemplateDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: newDashboardLibraryInteraction('item_clicked'),
  loaded: newDashboardLibraryInteraction('loaded'),
};

export const NewSuggestedDashboardsInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: newDashboardLibraryInteraction('suggested_item_clicked'),
  loaded: newDashboardLibraryInteraction('suggested_loaded'),
};

export const NewBasicProvisionedDashboardsInteractions = {
  ...NewDashboardLibraryInteractions,
  itemClicked: newDashboardLibraryInteraction('basic_provisioned_item_clicked'),
  loaded: newDashboardLibraryInteraction('basic_provisioned_loaded'),
};
