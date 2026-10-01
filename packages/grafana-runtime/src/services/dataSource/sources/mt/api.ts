import { config } from '../../../../config';

import { type DataSourceConnection, type DataSourceConnectionList, type DataSourceResource } from './types';

/** A non-ok response from an MT API. */
export class MTRequestError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly statusText: string
  ) {
    super(`Request to ${url} failed ${status}:${statusText}`);
    this.name = 'MTRequestError';
  }
}

export function getConnectionsUrl(): string {
  return `apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`;
}

export function getDataSourceResourceUrl(connection: DataSourceConnection): string {
  return `apis/${connection.group}/${connection.version}/namespaces/${config.namespace}/datasources/${encodeURIComponent(connection.name)}`;
}

export async function fetchConnections(): Promise<DataSourceConnectionList> {
  const url = getConnectionsUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new MTRequestError(url, response.status, response.statusText);
  }
  return response.json();
}

/** Resolves `undefined` on a 404; every other non-ok response throws. */
export async function fetchDataSourceResource(
  connection: DataSourceConnection
): Promise<DataSourceResource | undefined> {
  const url = getDataSourceResourceUrl(connection);
  const response = await fetch(url);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new MTRequestError(url, response.status, response.statusText);
  }
  return response.json();
}
