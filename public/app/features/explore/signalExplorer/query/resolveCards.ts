import { matchPluginId, type DataQuery, type DataSourceApi, type DataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

export interface CardModel {
  refId: string;
  dsRef: DataSourceRef;
  /** Undefined when the datasource no longer resolves; the host supplies a translated fallback. */
  dsName?: string;
  isPrometheus: boolean;
}

/**
 * One card per query, each resolved to its own concrete datasource. A query without an explicit
 * datasource inherits the pane's — except in a mixed pane, whose ref is not a real datasource and
 * must never reach a card or a data hook.
 *
 * This lives outside the shell on purpose: `SignalExplorerRail` is deletable by contract, and this
 * is the one piece of it that would be dangerous to re-derive — the Mixed nulling, the
 * settings-over-raw-ref preference and the managed-Prometheus check all have to be right for the
 * data hooks below to target the correct instance.
 */
export function resolveCards(
  queries: DataQuery[] | undefined,
  datasourceInstance: DataSourceApi | null | undefined
): CardModel[] {
  const paneRef = datasourceInstance?.meta.mixed ? undefined : datasourceInstance?.getRef();
  const dataSourceSrv = getDataSourceSrv();

  return (queries ?? []).map((query): CardModel => {
    const ref = query.datasource ?? paneRef;
    const settings = ref ? dataSourceSrv.getInstanceSettings(ref) : undefined;

    return {
      refId: query.refId,
      // Prefer the resolved settings over the raw ref so a card that inherited the pane's default
      // datasource still gets a concrete uid rather than a name-only or empty ref.
      dsRef: settings ? { uid: settings.uid, type: settings.type } : (ref ?? {}),
      dsName: settings?.name,
      // `matchPluginId`, not `type === 'prometheus'`: the managed flavours (Amazon, Azure) carry
      // their own plugin ids and browse exactly the same way.
      isPrometheus: settings ? matchPluginId('prometheus', settings.meta) : false,
    };
  });
}
