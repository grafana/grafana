import { type Location } from 'history';
import { useEffect } from 'react';

import { locationSearchToObject, locationService } from '@grafana/runtime';
import { useFlagAssistantFullscreenWorkspace } from '@grafana/runtime/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';

export interface FullscreenWorkspaceState {
  fullscreenWorkspaceFeatureFlagEnabled: boolean;
  /** Whether fullscreen workspace is currently active (flag enabled AND the chrome state is on). */
  fullscreenWorkspaceActive: boolean;
}

export function useFullscreenWorkspace(): FullscreenWorkspaceState {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const fullscreenWorkspaceFeatureFlagEnabled = useFlagAssistantFullscreenWorkspace();

  // Only subscribe to location when the feature is enabled — this keeps AppChrome free of a
  // location subscription when the flag is off, so it doesn't re-render on every SPA navigation.
  useEffect(() => {
    if (!fullscreenWorkspaceFeatureFlagEnabled) {
      return;
    }
    const consume = (location: Location) => {
      const queryParams = locationSearchToObject(location.search);
      if (queryParams.fullscreenWorkspace === '1' || queryParams.fullscreenWorkspace === true) {
        chrome.setFullscreenWorkspace(true);
        locationService.partial({ fullscreenWorkspace: null });
      }
    };
    consume(locationService.getLocation());
    const sub = locationService.getLocationObservable().subscribe(consume);
    return () => sub.unsubscribe();
  }, [chrome, fullscreenWorkspaceFeatureFlagEnabled]);

  return {
    fullscreenWorkspaceFeatureFlagEnabled,
    fullscreenWorkspaceActive: fullscreenWorkspaceFeatureFlagEnabled && Boolean(state.fullscreenWorkspace),
  };
}
