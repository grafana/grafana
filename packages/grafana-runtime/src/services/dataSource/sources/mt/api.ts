import { config } from '../../../../config';
import { getBackendSrv, isFetchError } from '../../../backendSrv';

import { type DataSourceConnection, type DataSourceConnectionList, type DataSourceResource } from './types';

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
