import { createContext, useCallback, useContext } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

import { GrafanaConfig } from '@grafana/data';
import { LocationService, locationService, BackendSrv } from '@grafana/runtime';

import { AppChromeService } from '../components/AppChrome/AppChromeService';
import { useExtensionSidebarContext } from '../components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
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

export function useChromeHeaderHeight() {
  const { chrome } = useGrafana();
  // if the extension sidebar is open, the inner pane will be scrollable, thus we need to set the header height to 0
  const { isOpen: isExtensionSidebarOpen } = useExtensionSidebarContext();

  return useObservable(isExtensionSidebarOpen ? of(0) : chrome.headerHeightObservable, 0);
}
