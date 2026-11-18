import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { type DataQuery } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../../../utils/utils';
import { getPanelIdForVizPanel } from '../../../../utils/utils-panels';
import { type PanelDataPaneNext } from '../../PanelDataPaneNext';
import { getPanelScopedVars } from '../utils';

import { QueryCoauthoringSessionEngine } from './QueryCoauthoringSessionEngine';
import {
  getCoauthoringGeneration,
  getCoauthoringSurface,
  mountCoauthoringPanel,
  publishCoauthoring,
  subscribeToCoauthoring,
  subscribeCoauthoringFlags,
  isQueryCoauthoringEnabled,
} from './queryCoauthoringApi';
import { reportCoauthoringError } from './queryCoauthoringContext';
import { type DataSourceWithQueryCoauthoring, isQueryCoauthoringLanguage } from './queryCoauthoringContracts';
import { isQueryBroken } from './queryCoauthoringHealth';
import { classifyQueryResult } from './queryCoauthoringPreviewOutcome';

export function useCoauthoringSurface() {
  useSyncExternalStore(subscribeToCoauthoring, getCoauthoringGeneration);
  return getCoauthoringSurface();
}

export function useMountedCoauthoringPanel(
  pane: PanelDataPaneNext,
  panel: VizPanel,
  queries: DataQuery[],
  select: (refId: string) => void
) {
  const selectRef = useRef(select);
  useLayoutEffect(() => {
    selectRef.current = select;
  }, [select]);
  const { datasource: defaultDatasource } = pane.useState();
  const enabled = useSyncExternalStore(subscribeCoauthoringFlags, isQueryCoauthoringEnabled);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const dashboard = getDashboardSceneFor(panel);
    const owner = dashboard.state.editPanel;
    if (!owner || owner.getPanel() !== panel) {
      return;
    }
    const dashboardUid = dashboard.state.uid;
    return mountCoauthoringPanel({
      panel,
      owner,
      target: { dashboardUid, panelId: getPanelIdForVizPanel(panel) },
      pane,
      supported: new Set(),
      select: (refId) => selectRef.current(refId),
    });
  }, [pane, panel, enabled]);

  useEffect(() => {
    const controller = new AbortController();
    const surface = getCoauthoringSurface(pane);
    if (!surface) {
      return;
    }
    pane.getCoauthoringHealth();
    void Promise.all(
      queries.map(async (query) => {
        try {
          const datasource: DataSourceWithQueryCoauthoring = await getDataSourceInstance(
            query.datasource ?? defaultDatasource?.getRef(),
            getPanelScopedVars(panel)
          );
          return isQueryCoauthoringLanguage(datasource.queryCoauthoring?.()) ? query.refId : undefined;
        } catch (error) {
          reportCoauthoringError(error, controller.signal, 'support_scan');
          return undefined;
        }
      })
    ).then((refs) => {
      if (!controller.signal.aborted) {
        surface.supported.clear();
        refs.forEach((refId) => {
          if (refId) {
            surface.supported.add(refId);
          }
        });
        // Notify subscribers after the asynchronous datasource contracts have resolved.
        publishCoauthoring();
      }
    });
    return () => {
      controller.abort();
    };
  }, [pane, panel, queries, enabled, defaultDatasource]);
  return useCoauthoringSurface();
}

export function useCoauthoringCardHealth(refId: string) {
  const surface = useCoauthoringSurface();
  const health = surface?.pane.getCoauthoringHealth() ?? {};
  const outcome = classifyQueryResult(
    surface && QueryCoauthoringSessionEngine.get(surface.panel)?.getCanonicalData(),
    refId
  );
  const errors = Object.fromEntries(
    Object.entries(health).map(([id, value]) => [id, value === 'no-data' ? ('ok' as const) : value])
  );
  return {
    errorMessage: outcome.kind === 'error' ? outcome.message : undefined,
    error: surface
      ? isQueryBroken(refId, surface.state?.queries ?? surface.pane.getCoauthoringEditorQueries() ?? [], errors)
      : false,
    noData: health[refId] === 'no-data',
  };
}
