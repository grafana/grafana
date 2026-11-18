import { useAssistant } from '@grafana/assistant';
import { useFlagAssistantDashboardPlanning } from '@grafana/runtime/internal';

/**
 * Whether the assistant-backed dashboard generation feature can be offered:
 * the feature flag is on and the Grafana Assistant is installed and
 * available for this user. Call sites add their own permission checks
 * (create for the dashboard prompt, edit for "improve this dashboard").
 *
 * `isLoading` is true only while the flag is on and assistant availability
 * has not resolved yet — callers that choose between UIs (empty dashboard)
 * should wait rather than treating the unresolved state as unavailable.
 */
export function useDashboardGenerationAvailable(): { isAvailable: boolean; isLoading: boolean } {
  const isFlagEnabled = useFlagAssistantDashboardPlanning();
  const { isAvailable, isLoading } = useAssistant();
  return {
    isAvailable: isFlagEnabled && isAvailable,
    isLoading: isFlagEnabled && isLoading,
  };
}
