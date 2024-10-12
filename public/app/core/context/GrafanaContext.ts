import { createContext, useCallback, useContext } from 'react';

import { GrafanaConfig } from '@grafana/data';
import { LocationService, locationService, BackendSrv, config } from '@grafana/runtime';

import { AppChromeService } from '../components/AppChrome/AppChromeService';
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

export function useChromeHeaderHeight() {
  const { chrome } = useGrafana();
  const { actions, kioskMode, searchBarHidden, chromeless } = chrome.useState();

  if (config.featureToggles.singleTopNav) {
    if (kioskMode || chromeless) {
      return 0;
    } else if (actions) {
      return TOP_BAR_LEVEL_HEIGHT * 2;
    } else {
      return TOP_BAR_LEVEL_HEIGHT;
    }
  } else {
    if (kioskMode || chromeless) {
      return 0;
    } else if (searchBarHidden) {
      return TOP_BAR_LEVEL_HEIGHT;
    } else {
      return TOP_BAR_LEVEL_HEIGHT * 2;
    }
  }
}
