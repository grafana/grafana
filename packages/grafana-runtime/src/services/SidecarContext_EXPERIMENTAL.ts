import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';

import { locationService as mainLocationService } from './LocationService';
import { SidecarService_EXPERIMENTAL, sidecarServiceSingleton_EXPERIMENTAL } from './SidecarService_EXPERIMENTAL';

export const SidecarContext_EXPERIMENTAL = createContext<SidecarService_EXPERIMENTAL>(
  sidecarServiceSingleton_EXPERIMENTAL
);

const HIDDEN_ROUTES = ['/login'];

/**
 * This is the main way to interact with the sidecar service inside a react context. It provides a wrapper around the
 * service props so that even though they are observables we just pass actual values to the components.
 *
 * @experimental
 */
export function useSidecar_EXPERIMENTAL() {
  // As the sidecar service functionality is behind feature flag this does not need to be for now
  const service = useContext(SidecarContext_EXPERIMENTAL);

  if (!service) {
    throw new Error('No SidecarContext found');
  }

  const initialContext = useObservable(service.initialContextObservable, service.initialContext);
  const activePluginId = useObservable(service.activePluginIdObservable, service.activePluginId);
  const locationService = service.getLocationService();
  const forceHidden = HIDDEN_ROUTES.includes(mainLocationService.getLocation().pathname);

  return {
    activePluginId: forceHidden ? undefined : activePluginId,
    initialContext: forceHidden ? undefined : initialContext,
    locationService,
    // TODO: currently this allows anybody to open any app, in the future we should probably scope this to the
    //  current app but that means we will need to incorporate this better into the plugin platform APIs which
    //  we will do once the functionality is reasonably stable
    openApp: (pluginId: string, context?: unknown) => {
      if (forceHidden) {
        return;
      }
      return service.openApp(pluginId, context);
    },
    openAppV2: (pluginId: string, path?: string) => {
      if (forceHidden) {
        return;
      }
      return service.openAppV2(pluginId, path);
    },
    closeApp: () => service.closeApp(),
    isAppOpened: (pluginId: string) => {
      if (forceHidden) {
        return false;
      }
      return service.isAppOpened(pluginId);
    },
  };
}
