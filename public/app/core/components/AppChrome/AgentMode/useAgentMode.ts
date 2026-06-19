import { type Location } from 'history';
import { useEffect } from 'react';

import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useFlagAssistantAgentMode } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AgentModeState {
  agentModeFeatureFlagEnabled: boolean;
  /** Whether agent mode is currently active (flag enabled AND the chrome state is on). */
  active: boolean;
}

export function useAgentMode(): AgentModeState {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const agentModeFeatureFlagEnabled = useFlagAssistantAgentMode();

  // Only subscribe to location when the feature is enabled — this keeps AppChrome free of a
  // location subscription when the flag is off, so it doesn't re-render on every SPA navigation.
  useEffect(() => {
    if (!agentModeFeatureFlagEnabled) {
      return;
    }
    const consume = (location: Location) => {
      const queryParams = locationSearchToObject(location.search);
      if (queryParams.agentMode === '1' || queryParams.agentMode === true) {
        chrome.setAgentMode(true);
        locationService.partial({ agentMode: null });
      }
    };
    consume(locationService.getLocation());
    const sub = locationService.getLocationObservable().subscribe(consume);
    return () => sub.unsubscribe();
  }, [chrome, agentModeFeatureFlagEnabled]);

  return { agentModeFeatureFlagEnabled, active: agentModeFeatureFlagEnabled && Boolean(state.agentMode) };
}
