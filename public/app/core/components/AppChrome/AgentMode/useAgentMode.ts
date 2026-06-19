import { useEffect } from 'react';

import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useFlagAssistantAgentMode } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AgentModeState {
  agentModeFeatureFlagEnabled: boolean;
  /** Whether agent mode is currently active (flag enabled AND the chrome state is on). */
  active: boolean;
}

export function useAgentMode(search: string): AgentModeState {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const agentModeFeatureFlagEnabled = useFlagAssistantAgentMode();

  useEffect(() => {
    if (!agentModeFeatureFlagEnabled) {
      return;
    }
    const queryParams = locationSearchToObject(search);
    if (queryParams.agentMode === '1' || queryParams.agentMode === true) {
      chrome.setAgentMode(true);
      locationService.partial({ agentMode: null });
    }
  }, [chrome, search, agentModeFeatureFlagEnabled]);

  return { agentModeFeatureFlagEnabled, active: agentModeFeatureFlagEnabled && Boolean(state.agentMode) };
}
