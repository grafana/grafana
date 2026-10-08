import {
  getPanelDataStatusItems,
  PanelStatusStore,
  type PanelData,
  type DataSourceApi,
  type PanelStatusActionResolver,
} from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { sceneGraph, type SceneDataProvider, type VizPanel } from '@grafana/scenes';
import type { PanelContext } from '@grafana/ui';

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
    let revision = 0;
    let provider: SceneDataProvider | undefined;
    let dataSubscription: { unsubscribe(): void } | undefined;
    let pluginId = panel.state.pluginId;
    const datasources = new Map<string, DataSourceApi | undefined>();
    let request: PanelData['request'];

    const update = () => {
      const currentRevision = ++revision;
      const data = provider?.state.data;
      if (data?.request !== request) {
        // Datasource variables can resolve to a different instance on the next request.
        datasources.clear();
        request = data?.request;
      }
      const entries = getPanelDataStatusItems(data, panel.state._pluginLoadError);
      const resolver: PanelStatusActionResolver = (entry) => {
        if (entry.datasourceUid && !datasources.has(entry.datasourceUid)) {
          // Do not briefly offer Assistant before the datasource's opt-out policy has loaded.
          return { assistant: 'hidden' };
        }
        const datasource = entry.datasourceUid ? datasources.get(entry.datasourceUid) : undefined;
        return datasource?.getPanelStatusActions?.(entry, {
          data,
          query: data?.request?.targets.find((query) => query.refId === entry.refId),
        });
      };
      store.setExternal(entries, resolver);
      const uids = [
        ...new Set(
          entries
            .map((entry) => entry.datasourceUid)
            .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0 && !datasources.has(uid))
        ),
      ];
      if (!uids.length) {
        return;
      }
      void Promise.all(
        uids.map(async (uid): Promise<[string, DataSourceApi | undefined]> => {
          try {
            return [uid, await getDataSourceInstance({ uid }, data?.request?.scopedVars)];
          } catch {
            return [uid, undefined];
          }
        })
      ).then((results) => {
        if (disposed || revision !== currentRevision) {
          return;
        }
        for (const [uid, datasource] of results) {
          datasources.set(uid, datasource);
        }
        store.setExternal(entries, resolver);
      });
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
