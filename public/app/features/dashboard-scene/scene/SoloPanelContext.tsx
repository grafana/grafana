import React, { useContext, useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { LazyLoader, type VizPanel } from '@grafana/scenes';
import { Box, LoadingPlaceholder, Spinner } from '@grafana/ui';
import { needsDynamicPalette } from 'app/features/dynamic-palettes/needsDynamicPalette';
import { useDynamicPalettesReady } from 'app/features/dynamic-palettes/useDynamicFieldColorModes';

import { type DashboardScene } from './DashboardScene';

export interface SoloPanelContextValue {
  matches: (VizPanel: VizPanel) => boolean;
  matchFound: boolean;
  matchedPanels?: VizPanel[];
}

export class SoloPanelContextWithPathIdFilter implements SoloPanelContextValue {
  public matchFound = false;
  public matchedPanels: VizPanel[] = [];

  public constructor(public keyPath: string) {}

  public matches(panel: VizPanel): boolean {
    // Check if keyPath is just an old legacy panel id
    if (/^\d+$/.test(this.keyPath)) {
      if (`panel-${this.keyPath}` === panel.state.key!) {
        this.matchFound = true;
        if (!this.matchedPanels.includes(panel)) {
          this.matchedPanels.push(panel);
        }
        return true;
      }

      return false;
    }

    if (this.keyPath === panel.getPathId()) {
      this.matchFound = true;
      if (!this.matchedPanels.includes(panel)) {
        this.matchedPanels.push(panel);
      }
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

export function renderMatchingSoloPanels(
  soloPanelContext: SoloPanelContextValue,
  panels: VizPanel[],
  isLazy?: boolean
) {
  const matches: React.ReactNode[] = [];
  for (const panel of panels) {
    if (soloPanelContext.matches(panel)) {
      matches.push(<MatchedSoloPanel key={panel.state.key!} panel={panel} isLazy={isLazy} />);
    }
  }

  return <>{matches}</>;
}

interface MatchedSoloPanelProps {
  panel: VizPanel;
  isLazy?: boolean;
}

function MatchedSoloPanel({ panel, isLazy }: MatchedSoloPanelProps) {
  // Mirror the gating behaviour applied by PanelWrapper in the dashboard view so editPanel,
  // viewPanel and panel search paths don't render visualisations with stale colours before
  // dynamic palettes finish loading.
  if (needsDynamicPalette(panel.state.fieldConfig)) {
    return <MatchedSoloPanelWithDynamicPaletteGate panel={panel} isLazy={isLazy} />;
  }

  return <MatchedSoloPanelContent panel={panel} isLazy={isLazy} />;
}

function MatchedSoloPanelWithDynamicPaletteGate({ panel, isLazy }: MatchedSoloPanelProps) {
  const palettesReady = useDynamicPalettesReady();

  if (!palettesReady) {
    return (
      <LoadingPlaceholder
        text={t('dashboard-scene.solo-panel.text-loading-dynamic-panel', 'Loading dynamic panel...')}
      />
    );
  }

  return <MatchedSoloPanelContent panel={panel} isLazy={isLazy} />;
}

function MatchedSoloPanelContent({ panel, isLazy }: MatchedSoloPanelProps) {
  if (isLazy) {
    return (
      <LazyLoader key={panel.state.key!}>
        <panel.Component model={panel} />
      </LazyLoader>
    );
  }

  return <panel.Component model={panel} />;
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
  const [state, setState] = useState({ matchFound: false, isLoading: true });

  useEffect(() => {
    // This effect fires before any child layout starts rendering and checking if their panels match the solo panel filter
    // We need this polling here to check if any solo panel has matched or if any layout has marked the context as loading (for repeated panels)
    const cancelTimeout = setInterval(() => {
      setState({ matchFound: context.matchFound, isLoading: isAnyVariableLoading(dashboard) });
    }, 500);

    return () => clearInterval(cancelTimeout);
  }, [context, dashboard]);

  if (state.matchFound || context.matchFound) {
    return null;
  }

  if (state.isLoading) {
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
