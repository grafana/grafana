import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';

import { SidecarService_EXPERIMENTAL } from './SidecarService_EXPERIMENTAL';

export const SidecarContext_EXPERIMENTAL = createContext<SidecarService_EXPERIMENTAL | undefined>(undefined);

export function useSidecar_EXPERIMENTAL() {
  // As the sidecar service functionality is behind feature flag this does not need to be for now
  const service = useContext(SidecarContext_EXPERIMENTAL);

  if (!service) {
    throw new Error('No SidecarContext found');
  }

  const activePluginId = useObservable(service.activePluginId, service.activePluginIdCurrent);
  const initialContext = useObservable(service.initialContext, service.initialContextCurrent);

  return {
    activePluginId,
    initialContext,
    openApp: (pluginId: string) => service.openApp(pluginId),
    closeApp: (pluginId: string) => service.closeApp(pluginId),
    isAppOpened: (pluginId: string) => service.isAppOpened(pluginId),
  };
}
