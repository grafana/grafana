import { config } from '../../../../config';
import { getBackendSrv, isFetchError } from '../../../backendSrv';

import { type DataSourceConnection, type DataSourceConnectionList, type DataSourceResource } from './types';

// The MT source logs its failed requests, and a 404 is an expected answer. Neither must show an error toast.
const REQUEST_OPTIONS = { showErrorAlert: false };

function getConnectionsUrl(): string {
  return `apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`;
}

function getDataSourceResourceUrl(connection: DataSourceConnection): string {
  return `apis/${connection.group}/${connection.version}/namespaces/${config.namespace}/datasources/${encodeURIComponent(connection.name)}`;
}

/** Every connection: the API returns at most 1000 per page, so this follows `metadata.continue`. */
export async function fetchConnections(): Promise<DataSourceConnectionList> {
  const items: DataSourceConnection[] = [];
  let next: string | undefined;
  do {
    const params = next ? { continue: next } : undefined;
    const page = await getBackendSrv().get<DataSourceConnectionList>(
      getConnectionsUrl(),
      params,
      undefined,
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
