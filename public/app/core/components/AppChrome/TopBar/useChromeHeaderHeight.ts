import { useEffect, useMemo, useState } from 'react';

import { config, useScopes } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { AppChromeState } from '../AppChromeService';
import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

function getHeaderHeight(
  chromeState: AppChromeState,
  isExtensionSidebarOpen: boolean,
  scopesEnabled: boolean | undefined = false,
  isSmallScreen = false
) {
  if (chromeState.kioskMode || chromeState.chromeless || isExtensionSidebarOpen) {
    return 0;
  }

  // If scopes or small screen use two levels
  if (scopesEnabled || isSmallScreen) {
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
  const theme = useTheme2();

  // if the extension sidebar is open, the inner pane will be scrollable, thus we need to set the header height to 0
  const { isOpen: isExtensionSidebarOpen } = useExtensionSidebarContext();
  const mediaQuery = useMemo(
    () => window.matchMedia(`(min-width: ${theme.breakpoints.values.xl}px)`),
    [theme.breakpoints.values.xl]
  );
  const [isSmallScreen, setIsSmallScreen] = useState(!mediaQuery.matches);

  const [headerHeight, setHeaderHeight] = useState(
    getHeaderHeight(state, isExtensionSidebarOpen, scopes?.state.enabled, isSmallScreen)
  );

  // Subscribe to chrome state changes and update header height
  useEffect(() => {
    const unsub = chrome.state.subscribe((state) => {
      const newHeaderHeight = getHeaderHeight(state, isExtensionSidebarOpen, isSmallScreen);
      if (newHeaderHeight !== headerHeight) {
        console.log('Header height is the same, not updating');
        setHeaderHeight(newHeaderHeight);
      }
    });

    return () => unsub.unsubscribe();
  }, [chrome, headerHeight, isExtensionSidebarOpen, isSmallScreen]);

  // Subscribe to media query changes and update isSmallScreen state
  // useEffect(() => {
  //   const onChange = (e: MediaQueryListEvent) => setIsSmallScreen(!e.matches);
  //   mediaQuery.addEventListener('change', onChange);
  //   return () => mediaQuery.removeEventListener('change', onChange);
  // }, [mediaQuery]);

  return headerHeight;
}
