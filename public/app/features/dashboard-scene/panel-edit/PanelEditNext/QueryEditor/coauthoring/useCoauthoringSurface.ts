import { isEqual } from 'lodash';
import { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { type DataQuery, type DataSourceRef } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';

import { getQueryRunnerFor } from '../../../../utils/getQueryRunnerFor';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { getPanelIdForVizPanel } from '../../../../utils/utils-panels';
import { type PanelDataPaneNext } from '../../PanelDataPaneNext';
import { getQueryDatasourceRef, resolveQueryDatasourceRef } from '../hooks/getQueryDatasourceRef';
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
  isQueryCoauthoringSurfaceActive,
} from './queryCoauthoringApi';
import { reportCoauthoringError, resolverInputs, subscribeResolverInputs } from './queryCoauthoringContext';
import { type DataSourceWithQueryCoauthoring, isQueryCoauthoringLanguage } from './queryCoauthoringContracts';
import { isQueryBroken } from './queryCoauthoringHealth';

function getSupportKey(queries: DataQuery[], datasource: DataSourceRef | undefined) {
  return JSON.stringify(queries.map((query) => [query.refId, getQueryDatasourceRef(query, datasource)]));
}

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
  const active = useSyncExternalStore(subscribeToCoauthoring, isQueryCoauthoringSurfaceActive);
  const supportKey = getSupportKey(queries, getQueryRunnerFor(panel)?.state.datasource);
  const lastScan = useRef<
    { key: string; resolverVersion: number; supported: Set<string>; complete: boolean; failed: boolean } | undefined
  >(undefined);
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
    if (!active || !surface || !runner) {
      return;
    }
    const previous = lastScan.current;
    if (
      previous?.complete &&
      !previous.failed &&
      previous.key === supportKey &&
      previous.resolverVersion === resolverVersion &&
      previous.supported === surface.supported
    ) {
      return;
    }
    const scan = { key: supportKey, resolverVersion, supported: surface.supported, complete: false, failed: false };
    lastScan.current = scan;
    const inputs = resolverInputs(panel, runner);
    const current = () =>
      !controller.signal.aborted &&
      isQueryCoauthoringSurfaceActive() &&
      supportKey === getSupportKey(runner.state.queries, runner.state.datasource) &&
      surface.owner.isActive &&
      getCoauthoringSurface(pane)?.owner === surface.owner &&
      isEqual(inputs, resolverInputs(panel, runner));
    void Promise.all(
      runner.state.queries.map(async (query) => {
        try {
          const resolved = await resolveQueryDatasourceRef(query, runner.state.datasource, getPanelScopedVars(panel));
          if (!resolved) {
            scan.failed = true;
            return undefined;
          }
          if (!current()) {
            return undefined;
          }
          const datasource: DataSourceWithQueryCoauthoring = await getDataSourceInstance(
            resolved.ref,
            getPanelScopedVars(panel)
          );
          return isQueryCoauthoringLanguage(datasource.queryCoauthoring?.()) ? query.refId : undefined;
        } catch (error) {
          scan.failed = true;
          if (current()) {
            reportCoauthoringError(error, controller.signal, 'support_scan');
          }
          return undefined;
        }
      })
    ).then((refs) => {
      if (current()) {
        scan.complete = true;
        const next = new Set(refs.filter((refId): refId is string => refId !== undefined));
        if (!isEqual(surface.supported, next)) {
          surface.supported.clear();
          next.forEach((refId) => surface.supported.add(refId));
          // Refresh support atomically after all current datasource contracts settle.
          publishCoauthoring();
        }
      }
    });
    return () => {
      controller.abort();
    };
  }, [pane, panel, supportKey, active, resolverVersion]);
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
