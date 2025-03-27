import { reportInteraction } from '@grafana/runtime';

export enum IRMInteractionNames {
  ViewIRMMainPage = 'grafana_irm_configuration_tracker_main_page_view',
  OpenEssentials = 'grafana_irm_configuration_tracker_essentials_open',
  CloseEssentials = 'grafana_irm_configuration_tracker_essentials_closed',
  ClickDataSources = 'grafana_irm_configuration_tracker_data_sources_clicked',
}

export interface ConfigurationTrackerContext {
  essentialStepsDone: number;
  essentialStepsToDo: number;
  dataSourceCompatibleWithAlerting: boolean;
}
export function trackIrmConfigurationTrackerEvent(
  interactionName: IRMInteractionNames,
  payload: ConfigurationTrackerContext
) {
  reportInteraction(interactionName, { ...payload });
}
