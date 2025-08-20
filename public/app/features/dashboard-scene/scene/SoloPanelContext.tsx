import React, { useContext } from 'react';

import { VizPanel } from '@grafana/scenes';

export interface SoloPanelContextValue {
  matches: (VizPanel: VizPanel) => boolean;
}

export class SoloPanelContextWithPathIdFilter implements SoloPanelContextValue {
  public constructor(public keyPath: string) {}

  public matches(panel: VizPanel): boolean {
    return this.keyPath === panel.getPathId();
  }
}

export const SoloPanelContext = React.createContext<SoloPanelContextValue | null>(null);

export function useDefineSoloPanelContext(keyPath?: string): SoloPanelContextValue | null {
  return React.useMemo(() => {
    if (!keyPath) {
      return null;
    }
    return new SoloPanelContextWithPathIdFilter(keyPath);
  }, [keyPath]);
}

export function useSoloPanelContext() {
  return useContext(SoloPanelContext);
}

export function renderMatchingSoloPanels(soloPanelContext: SoloPanelContextValue, panels: VizPanel[]) {
  const matches: React.ReactNode[] = [];
  for (const panel of panels) {
    if (soloPanelContext.matches(panel)) {
      matches.push(<panel.Component model={panel} key={panel.state.key} />);
    }
  }

  return <>{matches}</>;
}
