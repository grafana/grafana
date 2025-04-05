import { useEffect, useState } from 'react';

import { config, useScopes } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryChange';

import { AppChromeState } from '../AppChromeService';
import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

function getHeaderHeight(
  chromeState: AppChromeState,
  isExtensionSidebarOpen: boolean,
  scopesEnabled: boolean | undefined = false,
  isLargeScreen: boolean
) {
  if (chromeState.kioskMode || chromeState.chromeless || isExtensionSidebarOpen) {
    return 0;
  }

  // If scopes or small screen use two levels
  if (scopesEnabled || !isLargeScreen) {
    return TOP_BAR_LEVEL_HEIGHT * 2;
  }

  // If have actions and unifiedNavbars is disabled, use two levels
  if (chromeState.actions && !config.featureToggles.unifiedNavbars) {
    return TOP_BAR_LEVEL_HEIGHT * 2;
  }

  return TOP_BAR_LEVEL_HEIGHT;
}

export function useChromeHeaderHeight() {
  const { chrome } = useGrafana();
  const state = chrome.state.getValue();
  const scopes = useScopes();

  // if the extension sidebar is open, the inner pane will be scrollable, thus we need to set the header height to 0
  const { isOpen: isExtensionSidebarOpen } = useExtensionSidebarContext();
  const isLargeScreen = useMediaQueryMinWidth('xl');

  const [headerHeight, setHeaderHeight] = useState(
    getHeaderHeight(state, isExtensionSidebarOpen, scopes?.state.enabled, isLargeScreen)
  );

  // Subscribe to chrome state changes and update header height
  useEffect(() => {
    const unsub = chrome.state.subscribe((state) => {
      const newHeaderHeight = getHeaderHeight(state, isExtensionSidebarOpen, scopes?.state.enabled, isLargeScreen);
      if (newHeaderHeight !== headerHeight) {
        setHeaderHeight(newHeaderHeight);
      }
    });

    return () => unsub.unsubscribe();
  }, [chrome, headerHeight, isExtensionSidebarOpen, scopes, isLargeScreen]);

  return headerHeight;
}
