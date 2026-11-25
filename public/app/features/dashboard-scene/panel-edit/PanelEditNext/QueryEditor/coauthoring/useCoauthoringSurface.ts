import { isEqual } from 'lodash';
import { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { type DataQuery } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from '../../../../utils/getQueryRunnerFor';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { getPanelIdForVizPanel } from '../../../../utils/utils-panels';
import { type PanelDataPaneNext } from '../../PanelDataPaneNext';
import { resolveQueryDatasourceRef } from '../hooks/getQueryDatasourceRef';
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
import { reportCoauthoringError, resolverInputs, subscribeResolverInputs } from './queryCoauthoringContext';
import { type DataSourceWithQueryCoauthoring, isQueryCoauthoringLanguage } from './queryCoauthoringContracts';
import { isQueryBroken } from './queryCoauthoringHealth';

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
  const enabled = useSyncExternalStore(subscribeCoauthoringFlags, isQueryCoauthoringEnabled);
  const [resolverVersion, setResolverVersion] = useState(0);
  useLayoutEffect(() => (enabled ? pane.observeCoauthoringHealth() : undefined), [pane, enabled]);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const runner = getQueryRunnerFor(panel);
    if (!runner) {
      return;
    }
    let inputs = resolverInputs(panel, runner);
    return subscribeResolverInputs(panel, () => {
      const next = resolverInputs(panel, runner);
      if (!isEqual(inputs, next)) {
        inputs = next;
        setResolverVersion((value) => value + 1);
      }
    });
  }, [panel, enabled]);
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
      getEngine: () => QueryCoauthoringSessionEngine.getOrCreate(panel),
      select: (refId) => selectRef.current(refId),
    });
  }, [pane, panel, enabled]);

  useEffect(() => {
    const controller = new AbortController();
    const surface = getCoauthoringSurface(pane);
    const runner = getQueryRunnerFor(panel);
    if (!surface || !runner) {
      return;
    }
    const inputs = resolverInputs(panel, runner);
    const current = () =>
      !controller.signal.aborted &&
      surface.owner.isActive &&
      getCoauthoringSurface(pane)?.owner === surface.owner &&
      isEqual(inputs, resolverInputs(panel, runner));
    void Promise.all(
      queries.map(async (query) => {
        try {
          const resolved = await resolveQueryDatasourceRef(query, runner.state.datasource, getPanelScopedVars(panel));
          if (!resolved || !current()) {
            return undefined;
          }
          const datasource: DataSourceWithQueryCoauthoring = await getDataSourceInstance(
            resolved.ref,
            getPanelScopedVars(panel)
          );
          return isQueryCoauthoringLanguage(datasource.queryCoauthoring?.()) ? query.refId : undefined;
        } catch (error) {
          if (current()) {
            reportCoauthoringError(error, controller.signal, 'support_scan');
          }
          return undefined;
        }
      })
    ).then((refs) => {
      if (current()) {
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
  }, [pane, panel, queries, enabled, resolverVersion]);
  return useCoauthoringSurface();
}

export function useCoauthoringCardHealth(refId: string) {
  const surface = useCoauthoringSurface();
  const health = surface?.pane.getCoauthoringHealth() ?? {};
  return {
    errorMessage: surface?.pane.getCoauthoringQueryError(refId),
    error: surface
      ? isQueryBroken(
          refId,
          surface.state?.queries ?? surface.pane.getCoauthoringEditorQueries() ?? [],
          health,
          getQueryRunnerFor(surface.panel)?.state.datasource,
          false
        )
      : false,
    noData: health[refId] === 'no-data',
  };
}
