import { isEqual } from 'lodash';

import {
  getPanelDataStatusItems,
  PanelStatusStore,
  type ScopedVars,
  type PanelData,
  type DataSourceApi,
  type PanelStatusActionResolver,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { sceneGraph, type SceneDataProvider, type VizPanel } from '@grafana/scenes';
import type { PanelContext } from '@grafana/ui';

interface CachedDatasource {
  scopedVars?: ScopedVars;
  resolvedUid: string;
  loaded: boolean;
  instance?: DataSourceApi;
  request?: PanelData['request'];
}

/** Attaches runtime state to the cached context, never to serialized panel state. */
export function setupPanelNotices(panel: VizPanel, context: PanelContext) {
  const store = new PanelStatusStore();
  context.notices = store;
  let users = 0;
  let disconnect: (() => void) | undefined;
  context.activateNotices = () => {
    if (users++ === 0) {
      disconnect = connect();
    }
    return () => {
      if (--users === 0) {
        disconnect?.();
        disconnect = undefined;
        store.clear();
      }
    };
  };
  return store;

  function connect() {
    let disposed = false;
    let provider: SceneDataProvider | undefined;
    let dataSubscription: { unsubscribe(): void } | undefined;
    let pluginId = panel.state.pluginId;
    const datasources = new Map<string, CachedDatasource>();

    const update = () => {
      const data = provider?.state.data;
      const entries = getPanelDataStatusItems(data, panel.state._pluginLoadError);
      const scopedVars = data?.request?.scopedVars;
      const uids = new Set(entries.map((entry) => entry.datasourceUid).filter((uid): uid is string => Boolean(uid)));
      for (const uid of datasources.keys()) {
        if (!uids.has(uid)) {
          datasources.delete(uid);
        }
      }
      for (const uid of uids) {
        const resolvedUid = uid.includes('$')
          ? getTemplateSrv().replace(uid, scopedVars, (value: string | string[]) =>
              Array.isArray(value) ? value[0] : value
            )
          : uid;
        const cached = datasources.get(uid);
        if (
          cached?.resolvedUid === resolvedUid &&
          isEqual(cached.scopedVars, scopedVars) &&
          (!cached.loaded || cached.instance || cached.request === data?.request)
        ) {
          continue;
        }
        const entry: CachedDatasource = { scopedVars, resolvedUid, loaded: false, request: data?.request };
        datasources.set(uid, entry);
        void getDataSourceInstance({ uid }, scopedVars)
          .catch(() => undefined)
          .then((instance) => {
            if (disposed || datasources.get(uid) !== entry) {
              return;
            }
            entry.instance = instance;
            entry.loaded = true;
            // A load may span several refreshes; publish actions against the current query data.
            update();
          });
      }
      const resolver: PanelStatusActionResolver = (entry) => {
        const datasource = entry.datasourceUid ? datasources.get(entry.datasourceUid) : undefined;
        if (entry.datasourceUid && !datasource?.loaded) {
          // Do not briefly offer Assistant before the datasource's opt-out policy has loaded.
          return { assistant: 'hidden' };
        }
        return datasource?.instance?.getPanelStatusActions?.(entry, {
          data,
          query: data?.request?.targets.find((query) => query.refId === entry.refId),
        });
      };
      store.setExternal(entries, resolver);
    };

    const bind = () => {
      const next = sceneGraph.getData(panel);
      if (next !== provider) {
        dataSubscription?.unsubscribe();
        provider = next;
        dataSubscription = next.subscribeToState(update);
      }
      update();
    };
    const panelSubscription = panel.subscribeToState((state, previous) => {
      if (state.pluginId !== pluginId) {
        pluginId = state.pluginId;
        store.clear();
      }
      if (
        state.pluginId !== previous.pluginId ||
        state._pluginLoadError !== previous._pluginLoadError ||
        state.$data !== previous.$data
      ) {
        bind();
      }
    });
    bind();
    return () => {
      disposed = true;
      dataSubscription?.unsubscribe();
      panelSubscription.unsubscribe();
    };
  }
}
