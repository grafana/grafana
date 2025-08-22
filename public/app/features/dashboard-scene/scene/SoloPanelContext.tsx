import React, { useContext, useEffect } from 'react';

import { Trans } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { Box, Spinner, useForceUpdate } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';

export interface SoloPanelContextValue {
  matches: (VizPanel: VizPanel) => boolean;
  matchFound: boolean;
}

export class SoloPanelContextWithPathIdFilter implements SoloPanelContextValue {
  public matchFound = false;

  public constructor(public keyPath: string) {}

  public matches(panel: VizPanel): boolean {
    // Check if keyPath is just an old legacy panel id
    if (/^\d+$/.test(this.keyPath)) {
      if (`panel-${this.keyPath}` === panel.state.key!) {
        this.matchFound = true;
        return true;
      }

      return false;
    }

    if (this.keyPath === panel.getPathId()) {
      this.matchFound = true;
      return true;
    }

    return false;
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

export function SoloPanelContextProvider({
  children,
  value,
  singleMatch,
  dashboard,
}: {
  children: React.ReactNode;
  value: SoloPanelContextValue;
  singleMatch: boolean;
  dashboard: DashboardScene;
}) {
  return (
    <SoloPanelContext.Provider value={value}>
      {children}
      <SoloPanelNotFound singleMatch={singleMatch} dashboard={dashboard} />
    </SoloPanelContext.Provider>
  );
}

export interface SoloPanelNotFoundProps {
  /**
   * Controls panel not found error message
   */
  singleMatch: boolean;
  /**
   * Used to check if variables are loading
   */
  dashboard: DashboardScene;
}

export function SoloPanelNotFound({ singleMatch, dashboard }: SoloPanelNotFoundProps) {
  const context = useSoloPanelContext()!;
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    // This effect fires before any child layout starts rendering and checking if their panels match the solo panel filter
    // We need this polling here to check if any solo panel has matched or if any layout has marked the context as loading (for repeated panels)
    const cancelTimeout = setInterval(forceUpdate, 500);
    return () => clearInterval(cancelTimeout);
  }, [context, forceUpdate]);

  if (context.matchFound) {
    return null;
  }

  if (isAnyVariableLoading(dashboard)) {
    return <Spinner />;
  }

  return (
    <Box
      backgroundColor={'primary'}
      borderColor={'weak'}
      borderStyle={'solid'}
      padding={2}
      borderRadius={'default'}
      display={'flex'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      {singleMatch && <Trans i18nKey="dashboard.view-panel.not-found">Panel not found</Trans>}
      {!singleMatch && <Trans i18nKey="dashboard.search-panel.no-match">No panels matching</Trans>}
    </Box>
  );
}

function isAnyVariableLoading(scene: DashboardScene) {
  const variables = scene.state.$variables;
  if (!variables || !variables.isActive) {
    return true;
  }

  return variables.state.variables.some((variable) => variable.state.loading);
}
