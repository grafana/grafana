import React, { createContext, useCallback, useContext, useEffect } from 'react';

import { GrafanaConfig } from '@grafana/data';
import { LocationService, locationService, BackendSrv, useScopes } from '@grafana/runtime';

import { AppChromeService, AppChromeState } from '../components/AppChrome/AppChromeService';
import { useExtensionSidebarContext } from '../components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { TOP_BAR_LEVEL_HEIGHT } from '../components/AppChrome/types';
import { NewFrontendAssetsChecker } from '../services/NewFrontendAssetsChecker';
import { KeybindingSrv } from '../services/keybindingSrv';

export interface GrafanaContextType {
  backend: BackendSrv;
  location: LocationService;
  config: GrafanaConfig;
  chrome: AppChromeService;
  keybindings: KeybindingSrv;
  newAssetsChecker: NewFrontendAssetsChecker;
}

export const GrafanaContext = createContext<GrafanaContextType | undefined>(undefined);

export function useGrafana(): GrafanaContextType {
  const context = useContext(GrafanaContext);
  if (!context) {
    throw new Error('No GrafanaContext found');
  }
  return context;
}

// Implementation of useReturnToPrevious that's made available through
// @grafana/runtime
export function useReturnToPreviousInternal() {
  const { chrome } = useGrafana();
  return useCallback(
    (title: string, href?: string) => {
      const { pathname, search } = locationService.getLocation();
      chrome.setReturnToPrevious({
        title: title,
        href: href ?? pathname + search,
      });
    },
    [chrome]
  );
}

function getHeaderHeight(
  chromeState: AppChromeState,
  isExtensionSidebarOpen: boolean,
  scopesEnabled: boolean | undefined = false
) {
  if (chromeState.kioskMode || chromeState.chromeless || isExtensionSidebarOpen) {
    return 0;
  }

  if (scopesEnabled || chromeState.actions) {
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
  const [headerHeight, setHeaderHeight] = React.useState(
    getHeaderHeight(state, isExtensionSidebarOpen, scopes?.state.enabled)
  );

  useEffect(() => {
    const unsub = chrome.state.subscribe((state) => {
      const newHeaderHeight = getHeaderHeight(state, isExtensionSidebarOpen);
      if (newHeaderHeight !== headerHeight) {
        console.log('Header height is the same, not updating');
        setHeaderHeight(newHeaderHeight);
      }
    });

    return () => unsub.unsubscribe();
  }, [chrome, headerHeight, isExtensionSidebarOpen]);

  return headerHeight;
}
