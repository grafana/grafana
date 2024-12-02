import { ReactNode } from 'react';

import { ScopesContext } from '@grafana/runtime';

import { getScopesService, initializeScopesServices } from './services';

interface ScopesContextProviderProps {
  children: ReactNode;
}

export const ScopesContextProvider = ({ children }: ScopesContextProviderProps) => {
  initializeScopesServices();

  const scopesService = getScopesService();

  if (!scopesService) {
    return children;
  }

  return <ScopesContext.Provider value={scopesService}>{children}</ScopesContext.Provider>;
};
