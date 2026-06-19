import { useEffect } from 'react';

import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

// TODO: Gate behind real feature flag.
const isAgentModeEnabled = true;

export function useAgentMode(search: string): boolean {
  const { chrome } = useGrafana();
  const state = chrome.useState();

  useEffect(() => {
    const queryParams = locationSearchToObject(search);
    if (queryParams.agentMode === '1' || queryParams.agentMode === true) {
      chrome.setAgentMode(true);
      locationService.partial({ agentMode: null });
    }
  }, [chrome, search]);

  return isAgentModeEnabled && Boolean(state.agentMode);
}
