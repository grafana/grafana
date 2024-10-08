import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';

import { SidecarService, sidecarService } from '../services/SidecarService';

export const SidecarContext = createContext<SidecarService>(sidecarService);

export function useSidecar() {
  const service = useContext(SidecarContext);
  const activePluginId = useObservable(service.activePluginId);
  const initialContext = useObservable(service.initialContext);

  if (!service) {
    throw new Error('No SidecarContext found');
  }

  return {
    activePluginId,
    initialContext,
    openApp: (pluginId: string, context?: unknown) => service.openApp(pluginId, context),
    closeApp: (pluginId: string) => service.closeApp(pluginId),
    isAppOpened: (pluginId: string) => service.isAppOpened(pluginId),
  };
}
