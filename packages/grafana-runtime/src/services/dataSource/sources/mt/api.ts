import { type DataSourcePluginMeta } from '@grafana/data';

import { config } from '../../../../config';
import { getBackendSrv, isFetchError } from '../../../backendSrv';

import {
  type DataSourceConnection,
  type DataSourceConnectionList,
  type DataSourceResource,
  type DataSourceResourceList,
} from './types';

// The MT source logs its failed requests, and a 404 is an expected answer. Neither must show an error toast.
const REQUEST_OPTIONS = { showErrorAlert: false };

function getConnectionsUrl(): string {
  return `apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`;
}

function getDataSourceResourceUrl(connection: DataSourceConnection): string {
  const VERSION = 'v0alpha1';
  return `apis/${connection.group}/${VERSION}/namespaces/${config.namespace}/datasources/${encodeURIComponent(connection.name)}`;
}

export interface FetchConnectionsOptions {
  /** Shared by every page request, so a newer fetch with the same id cancels the request in flight. */
  requestId: string;
  /** Checked before each page. A fetch that a newer one replaced stops and resolves `undefined`. */
  isCurrent: () => boolean;
}

/** Every connection: the API returns at most 1000 per page, so this follows `metadata.continue`. */
export async function fetchConnections({
  requestId,
  isCurrent,
}: FetchConnectionsOptions): Promise<DataSourceConnectionList | undefined> {
  const items: DataSourceConnection[] = [];
  let next: string | undefined;
  do {
    // A page request would cancel the newer fetch's request, because both use the same id.
    if (!isCurrent()) {
      return undefined;
    }
    const params = next ? { continue: next } : undefined;
    const page = await getBackendSrv().get<DataSourceConnectionList>(
      getConnectionsUrl(),
      params,
      requestId,
      REQUEST_OPTIONS
    );
    items.push(...(page.items ?? []));
    next = page.metadata?.continue;
  } while (next);
  return { items };
}

/** Resolves `undefined` on a 404; every other failure rejects with the `FetchError`. */
export async function fetchDataSourceResource(
  connection: DataSourceConnection
): Promise<DataSourceResource | undefined> {
  try {
    return await getBackendSrv().get<DataSourceResource>(
      getDataSourceResourceUrl(connection),
      undefined,
      undefined,
      REQUEST_OPTIONS
    );
  } catch (error) {
    if (isFetchError(error) && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

const API_VERSION = 'v0alpha1';

function getDataSourcesUrl(group: string): string {
  return `apis/${group}/${API_VERSION}/namespaces/${config.namespace}/datasources`;
}

/**
 * Every data source, read from the API group each installed plugin serves.
 *
 * This exists because the `connections` endpoint is backed by the legacy data source service, so it
 * cannot see a data source that lives only in unified storage — which is every data source written
 * through the new APIs, everything Git Sync provisions included. There is no endpoint that lists
 * across the groups (each plugin serves its own, and the collection they share is not served), so
 * this asks each in turn and synthesizes the connections the rest of the source already works from.
 *
 * A group that answers 404 is skipped: its plugin is installed but no API group was registered for
 * it, which must not fail the whole list.
 */
export async function fetchConnectionsFromGroups(
  metas: DataSourcePluginMeta[],
  { requestId, isCurrent }: FetchConnectionsOptions
): Promise<DataSourceConnectionList | undefined> {
  // Built-in data sources (-- Grafana --, -- Mixed --, -- Dashboard --) hold no instances; the
  // mapper synthesizes them from the metas instead.
  const groups = metas.filter((meta) => !meta.builtIn).map((meta) => ({ pluginId: meta.id }));

  const pages = await Promise.all(
    // A distinct request id per group: they share one id only to let a newer fetch cancel an older
    // one, and reusing it across parallel requests would cancel the siblings instead.
    groups.map(({ pluginId }) => fetchGroupDataSources(pluginId, `${requestId}:${pluginId}`, isCurrent))
  );
  if (!isCurrent()) {
    return undefined;
  }
  return { items: pages.flat() };
}

/** One plugin's group, following `metadata.continue`. Resolves empty when the group is not served. */
async function fetchGroupDataSources(
  pluginId: string,
  requestId: string,
  isCurrent: () => boolean
): Promise<DataSourceConnection[]> {
  const group = `${pluginId}.datasource.grafana.app`;
  const items: DataSourceConnection[] = [];
  let next: string | undefined;
  do {
    if (!isCurrent()) {
      return [];
    }
    const params = next ? { continue: next } : undefined;
    let page: DataSourceResourceList;
    try {
      page = await getBackendSrv().get<DataSourceResourceList>(
        getDataSourcesUrl(group),
        params,
        requestId,
        REQUEST_OPTIONS
      );
    } catch (error) {
      if (isFetchError(error) && error.status === 404) {
        return [];
      }
      throw error;
    }
    for (const resource of page.items ?? []) {
      items.push({
        title: resource.spec.title,
        name: resource.metadata.name,
        group,
        plugin: pluginId,
        labels: resource.metadata.labels,
      });
    }
    next = page.metadata?.continue;
  } while (next);
  return items;
}
