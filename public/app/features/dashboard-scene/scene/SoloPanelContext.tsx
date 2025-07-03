import React, { useContext } from 'react';

export class SoloPanelContextValue {
  public constructor(public keyPath: string) {}

  public matches(keyPath: string): boolean {
    return this.keyPath.startsWith(keyPath);
  }
}

export const SoloPanelContext = React.createContext<SoloPanelContextValue | null>(null);

export function useDefineSoloPanelContext(keyPath?: string): SoloPanelContextValue | null {
  return React.useMemo(() => {
    if (!keyPath) {
      return null;
    }
    return new SoloPanelContextValue(keyPath);
  }, [keyPath]);
}

export function useSoloPanelContext() {
  return useContext(SoloPanelContext);
}
