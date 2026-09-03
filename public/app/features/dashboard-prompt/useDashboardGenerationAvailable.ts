import { useAssistant } from '@grafana/assistant';
import { useFlagAssistantDashboardPlanning } from '@grafana/runtime/internal';

/**
 * Whether the assistant-backed dashboard generation feature can be offered:
 * the feature flag is on and the Grafana Assistant is installed and
 * available for this user. Call sites add their own permission checks
 * (create for the dashboard prompt, edit for "improve this dashboard").
 */
export function useDashboardGenerationAvailable(): boolean {
  const isFlagEnabled = useFlagAssistantDashboardPlanning();
  const { isAvailable } = useAssistant();
  return isFlagEnabled && isAvailable;
}
