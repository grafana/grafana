import React from 'react';

import { DashboardScene } from '../../scene/DashboardScene';

interface Context {
  dashboard: DashboardScene;
}

export const ShareDrawerContext = React.createContext<Context | undefined>(undefined);

const useShareDrawerContext = () => {
  const context = React.useContext(ShareDrawerContext);

  if (context === undefined) {
    throw new Error('useShareDrawerContext must be used within a DrawerContext');
  }

  return context;
};

export { useShareDrawerContext };
