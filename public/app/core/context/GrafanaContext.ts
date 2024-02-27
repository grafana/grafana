import React, { useCallback, useContext } from 'react';

import { GrafanaConfig } from '@grafana/data';
import { LocationService, locationService, BackendSrv } from '@grafana/runtime';
import { ReactivePluginExtensionsRegistry } from 'app/features/plugins/extensions/reactivePluginExtensionRegistry';

import { AppChromeService } from '../components/AppChrome/AppChromeService';
import { NewFrontendAssetsChecker } from '../services/NewFrontendAssetsChecker';
import { KeybindingSrv } from '../services/keybindingSrv';

export interface GrafanaContextType {
  backend: BackendSrv;
  location: LocationService;
  config: GrafanaConfig;
  chrome: AppChromeService;
  keybindings: KeybindingSrv;
  newAssetsChecker: NewFrontendAssetsChecker;
  extensionsRegistry: ReactivePluginExtensionsRegistry;
}

export const GrafanaContext = React.createContext<GrafanaContextType | undefined>(undefined);

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
