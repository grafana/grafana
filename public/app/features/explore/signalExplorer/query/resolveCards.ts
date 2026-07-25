import { matchPluginId, type DataQuery, type DataSourceApi, type DataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

export interface CardModel {
  refId: string;
  dsRef: DataSourceRef;
  /** Undefined when the datasource no longer resolves; the host supplies a translated fallback. */
  dsName?: string;
  isPrometheus: boolean;
  /**
   * The pane's queries that run against this same datasource, including this card's own. A metric
   * name only means something inside the datasource that defines it, so these are the only queries
   * whose refIds may badge this card's metrics.
   */
  matchQueries: DataQuery[];
}

/** Identity of a resolved ref, for grouping only. Both halves matter: an unresolvable `{ uid }` and
 *  a type-only ref are different datasources even though one of the two fields is empty. */
function refKey(dsRef: DataSourceRef): string {
  return `${dsRef.uid ?? ''}|${dsRef.type ?? ''}`;
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

  const resolved = (queries ?? []).map((query) => {
    const ref = query.datasource ?? paneRef;
    const settings = ref ? dataSourceSrv.getInstanceSettings(ref) : undefined;

    return {
      query,
      settings,
      // Prefer the resolved settings over the raw ref so a card that inherited the pane's default
      // datasource still gets a concrete uid rather than a name-only or empty ref.
      dsRef: settings ? { uid: settings.uid, type: settings.type } : (ref ?? {}),
    };
  });

  const queriesByDatasource = new Map<string, DataQuery[]>();
  for (const { query, dsRef } of resolved) {
    const key = refKey(dsRef);
    const group = queriesByDatasource.get(key);
    if (group) {
      group.push(query);
    } else {
      queriesByDatasource.set(key, [query]);
    }
  }

  return resolved.map(
    ({ query, settings, dsRef }): CardModel => ({
      refId: query.refId,
      dsRef,
      dsName: settings?.name,
      // `matchPluginId`, not `type === 'prometheus'`: the managed flavours (Amazon, Azure) carry
      // their own plugin ids and browse exactly the same way.
      isPrometheus: settings ? matchPluginId('prometheus', settings.meta) : false,
      matchQueries: queriesByDatasource.get(refKey(dsRef)) ?? [],
    })
  );
}
