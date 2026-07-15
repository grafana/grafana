import { useAssistant } from '@grafana/assistant';
import { config } from '@grafana/runtime';

/**
 * Whether the assistant-backed dashboard generation feature can be offered:
 * the feature toggle is on and the Grafana Assistant is installed and
 * available for this user. Call sites add their own permission checks
 * (create for the wizard, edit for "improve this dashboard").
 */
export function useDashboardGenerationAvailable(): boolean {
  const { isAvailable } = useAssistant();
  return Boolean(config.featureToggles.dashboardGenerationWizard) && isAvailable;
}
