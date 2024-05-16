import { reportInteraction } from '@grafana/runtime/src';

export enum IRMInteractionNames {
  ViewIRMMainPage = 'grafana_irm_configuration_tracker_main_page_view',
  OpenEssentials = 'grafana_irm_configuration_tracker_essentials_open',
  CloseEssentials = 'grafana_irm_configuration_tracker_essentials_closed',
}

export interface ConfigurationTrackerContext {
  essentialStepsDone: number;
  essentialStepsToDo: number;
}
export function trackIrmConfigurationTrackerEvent(
  interactionName: IRMInteractionNames,
  payload: ConfigurationTrackerContext
) {
  reportInteraction(interactionName, { ...payload });
}
