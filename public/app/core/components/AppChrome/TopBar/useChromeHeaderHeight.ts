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

  // If scopes always use two levels or menu docked
  if (scopesEnabled || chromeState.megaMenuDocked) {
    return 2;
  }

  // If we have actions and and screen is small (or unifiedNavbars is disabled) then we need two levels
  if (chromeState.actions && (!isLargeScreen || !config.featureToggles.unifiedNavbars)) {
    return 2;
  }

  return 1;
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
