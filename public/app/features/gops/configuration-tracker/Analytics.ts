import { createMonitoringLogger } from '@grafana/runtime';
import { reportInteraction } from '@grafana/runtime/src';

export const LogMessages = {
  filterByLabel: 'filtering alert instances by label',
};

const { logInfo, logError, logMeasurement } = createMonitoringLogger('features.irm.configuration-tracker', {
  module: 'IRM',
});

export { logError, logInfo, logMeasurement };

export interface ConfigurationTrackerContext {
  essentialStepsDone: number;
  essentialStepsToDo: number;
}
export function trackIrmMainPageView(payload: ConfigurationTrackerContext) {
  reportInteraction('grafana_irm_configuration_tracker_main_page_view', { ...payload });
}
export function trackOpenIrmConfigurationEssentials(payload: ConfigurationTrackerContext) {
  reportInteraction('grafana_irm_configuration_tracker_essentials_open', { ...payload });
}
export function trackCloseIrmConfigurationEssentials(payload: ConfigurationTrackerContext) {
  reportInteraction('grafana_irm_configuration_tracker_essentials_closed', { ...payload });
}
