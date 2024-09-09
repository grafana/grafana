import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';

import { SidecarService, sidecarService } from '../services/SidecarService';

export const SidecarContext = createContext<SidecarService>(sidecarService);

export function useSidecar() {
  const activePluginId = useObservable(sidecarService.activePluginId);
  const context = useContext(SidecarContext);

  if (!context) {
    throw new Error('No SidecarContext found');
  }

  return {
    activePluginId,
    openApp: (pluginId: string) => context.openApp(pluginId),
    closeApp: (pluginId: string) => context.closeApp(pluginId),
    isAppOpened: (pluginId: string) => context.isAppOpened(pluginId),
  };
}
