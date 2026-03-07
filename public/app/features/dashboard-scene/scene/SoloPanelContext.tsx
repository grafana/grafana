import React, { useContext, useEffect, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { LazyLoader, VizPanel } from '@grafana/scenes';
import { Box, Spinner } from '@grafana/ui';

import { RepeatsUpdatedEvent } from '../edit-pane/shared';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from './layout-default/DashboardGridItem';

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

export function renderMatchingSoloPanels(
  soloPanelContext: SoloPanelContextValue,
  panels: VizPanel[],
  isLazy?: boolean
) {
  const matches: React.ReactNode[] = [];
  for (const panel of panels) {
    if (soloPanelContext.matches(panel)) {
      if (isLazy) {
        matches.push(
          <LazyLoader key={panel.state.key!}>
            <panel.Component model={panel} />
          </LazyLoader>
        );
      } else {
        matches.push(<panel.Component model={panel} key={panel.state.key} />);
      }
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
  const [state, setState] = useState({ matchFound: false, isLoading: true });

  useEffect(() => {
    const checkState = () => {
      setState({ matchFound: context.matchFound, isLoading: isStillLoading(dashboard) });
    };

    // Ensure all repeaters are activated so performRepeat() can run.
    dashboard.state.body.activateRepeaters?.();

    // Activate body panels that have LibraryPanelBehavior so the async
    // library panel fetch can run. Without this, library panels in solo
    // panel mode are never rendered (because they don't match yet), so
    // their behavior never activates and the repeat migration never runs.
    activateLibraryPanelBodies(dashboard);

    const cancelTimeout = setInterval(checkState, 500);

    // Re-check immediately when any repeat finishes processing.
    const sub = dashboard.subscribeToEvent(RepeatsUpdatedEvent, checkState);

    return () => {
      clearInterval(cancelTimeout);
      sub.unsubscribe();
    };
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

export function isStillLoading(scene: DashboardScene): boolean {
  if (isAnyVariableLoading(scene)) {
    return true;
  }

  if (hasAnyPendingRepeats(scene)) {
    return true;
  }

  if (hasAnyLibraryPanelLoading(scene)) {
    return true;
  }

  return false;
}

function isAnyVariableLoading(scene: DashboardScene) {
  const variables = scene.state.$variables;
  if (!variables || !variables.isActive) {
    return true;
  }

  return variables.state.variables.some((variable) => variable.state.loading);
}

/**
 * Checks whether any repeating grid item still has an unprocessed repeat.
 * A grid item with `variableName` set but `repeatedPanels` still undefined
 * means `performRepeat()` hasn't completed yet.
 */
export function hasAnyPendingRepeats(scene: DashboardScene): boolean {
  return scene.state.body.getVizPanels().some((panel) => {
    const parent = panel.parent;
    if (parent instanceof DashboardGridItem || parent instanceof AutoGridItem) {
      return !!parent.state.variableName && parent.state.repeatedPanels === undefined;
    }
    return false;
  });
}

/**
 * Checks whether any grid item contains a library panel whose content
 * hasn't loaded yet. The library panel may carry repeat configuration
 * that only gets migrated to the grid item after loading completes.
 */
export function hasAnyLibraryPanelLoading(scene: DashboardScene): boolean {
  return scene.state.body.getVizPanels().some(hasUnloadedLibraryPanelBehavior);
}

/**
 * In solo panel mode the renderer only mounts panels that already match
 * the filter, which means library panels whose repeat config hasn't been
 * fetched yet are never activated. Force-activate each body VizPanel
 * that carries a LibraryPanelBehavior so the async fetch + repeat
 * migration can proceed.
 */
function activateLibraryPanelBodies(scene: DashboardScene): void {
  for (const panel of scene.state.body.getVizPanels()) {
    if (hasUnloadedLibraryPanelBehavior(panel) && !panel.isActive) {
      panel.activate();
    }
  }
}

function hasUnloadedLibraryPanelBehavior(panel: VizPanel): boolean {
  return !!panel.state.$behaviors?.some(
    (b) => b instanceof LibraryPanelBehavior && !b.state.isLoaded
  );
}
