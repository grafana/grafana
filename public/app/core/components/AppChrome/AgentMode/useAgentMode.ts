import { useEffect } from 'react';

import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

// PoC: hardcoded on. Phase 2 -> gate behind `assistantAgentMode` feature flag.
const isAgentModeEnabled = true;

/**
 * Owns agent-mode entry + derivation so AppChrome stays a one-liner (`useAgentMode(search)`)
 * and no agent-mode logic leaks into the core chrome:
 *
 *  - Consumes the one-shot `?agentMode=1` URL request (e.g. from the assistant plugin's
 *    "Open in Workspace") — enters agent mode and clears the param so it doesn't re-trigger
 *    or leak onto subsequent Platform-tab navigation.
 *  - Returns whether agent mode is currently active (gated on the PoC flag).
 *
 * @param search the current location search string (AppChrome already subscribes to it).
 */
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
