import { useEffect, useState } from 'react';

import { config, useScopes } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { AppChromeState } from '../AppChromeService';
import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';

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
  // No levels when chromeless or kiosk mode
  if (chromeState.kioskMode || chromeState.chromeless) {
    return 0;
  }

  // Always use two levels scopes is enabled
  if (scopesEnabled) {
    return 2;
  }

  // No actions we can always use 1 level
  if (!chromeState.actions) {
    return 1;
  }

  // We have actions
  // If mega menu docked always use two levels
  // If scenes disabled always use two levels (mainly because of the time range picker)
  if (chromeState.megaMenuDocked || !config.featureToggles.dashboardScene) {
    return 2;
  }

  // If screen is large and unifiedNavbars is not disabled then we can use 1 level
  if (isLargeScreen && config.featureToggles.unifiedNavbars) {
    return 1;
  }

  return 2;
}

/**
 * Translates header levels to header height but also takes the
 * sidebar into account as header height can be treated as zero when the sidebar is open
 * this should be better named as useStickyTopPadding or something as that is what is's used for
 */
export function useChromeHeaderHeight() {
  const levels = useChromeHeaderLevels();

  // if the extension sidebar is open, the inner pane will be scrollable, thus we need to set the header height to 0
  const { isOpen: isExtensionSidebarOpen } = useExtensionSidebarContext();

  if (isExtensionSidebarOpen) {
    return 0;
  }

  return levels * getChromeHeaderLevelHeight();
}

/**
 * Can replace with constant once unifiedNavbars feature toggle is removed
 **/
export function getChromeHeaderLevelHeight() {
  // Waiting with switch to 48 until we have a story for scopes
  // return config.featureToggles.unifiedNavbars ? 48 : 40;
  return 40;
}
