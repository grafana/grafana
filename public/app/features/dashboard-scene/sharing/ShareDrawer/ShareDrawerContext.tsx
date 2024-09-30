import { createContext, useContext } from 'react';

import { DashboardScene } from '../../scene/DashboardScene';

interface Context {
  dashboard: DashboardScene;
  onDismiss: () => void;
}

export const ShareDrawerContext = createContext<Context | undefined>(undefined);

const useShareDrawerContext = () => {
  const context = useContext(ShareDrawerContext);

  if (context === undefined) {
    throw new Error('useShareDrawerContext must be used within a DrawerContext');
  }

  return context;
};

export { useShareDrawerContext };
