import { useEffect, useState } from 'react';

import { config, useScopes } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { AppChromeState } from '../AppChromeService';
import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

/**
 * Returns the current header levels given current app chrome state, scopes and screen size.
 */
export function useChromeHeaderLevels() {
  const { chrome } = useGrafana();
  const state = chrome.state.getValue();
  const scopes = useScopes();

  const isLargeScreen = useMediaQueryMinWidth('xl');

  const [headerLevels, setHeaderLevels] = useState(
    getHeaderLevelsGivenState(state, scopes?.state.enabled, isLargeScreen)
  );

  // Subscribe to chrome state changes and update header height
  useEffect(() => {
    const unsub = chrome.state.subscribe((state) => {
      const newLevels = getHeaderLevelsGivenState(state, scopes?.state.enabled, isLargeScreen);
      if (newLevels !== headerLevels) {
        setHeaderLevels(newLevels);
      }
    });

    return () => unsub.unsubscribe();
  }, [chrome, headerLevels, scopes, isLargeScreen]);

  return headerLevels;
}

function getHeaderLevelsGivenState(
  chromeState: AppChromeState,
  scopesEnabled: boolean | undefined = false,
  isLargeScreen: boolean
) {
  if (chromeState.kioskMode || chromeState.chromeless) {
    return 0;
  }

  // If scopes or small screen use two levels
  if (scopesEnabled || !isLargeScreen) {
    return 2;
  }

  // If have actions and unifiedNavbars is disabled, use two levels
  if (chromeState.actions && !config.featureToggles.unifiedNavbars) {
    return 2;
  }

  return 1;
}

/**
 * Translates header levels to header height but also takes the
 * sidebar into account as header height can be treated as zero when the sidebar is open
 */
export function useChromeHeaderHeight() {
  const levels = useChromeHeaderLevels();

  // if the extension sidebar is open, the inner pane will be scrollable, thus we need to set the header height to 0
  const { isOpen: isExtensionSidebarOpen } = useExtensionSidebarContext();

  if (isExtensionSidebarOpen) {
    return 0;
  }

  return levels * TOP_BAR_LEVEL_HEIGHT;
}
