import { ReactNode } from 'react';

import { ScopesContext } from '@grafana/runtime';

import { ScopesService } from './ScopesService';

interface ScopesContextProviderProps {
  children: ReactNode;
}

export const ScopesContextProvider = ({ children }: ScopesContextProviderProps) => {
  return <ScopesContext.Provider value={ScopesService.instance}>{children}</ScopesContext.Provider>;
};
