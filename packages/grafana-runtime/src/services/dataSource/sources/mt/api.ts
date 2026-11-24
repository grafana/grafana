import { resolveAPIBaseURLOutcome, toBaseURL } from '../../../apiDiscovery/resolve';
import { getBackendSrv, isFetchError } from '../../../backendSrv';

import { type DataSourceConnection, type DataSourceConnectionList, type DataSourceResource } from './types';

// The MT source logs its failed requests, and a 404 is an expected answer. Neither must show an error toast.
const REQUEST_OPTIONS = { showErrorAlert: false };

const QUERY_GROUP = 'query.grafana.app';
const SUPPORTED_VERSIONS = ['v0alpha1', 'v1beta1'];
// Every MT API served this version before discovery, so it is the best guess when discovery cannot answer.
const LEGACY_VERSION = 'v0alpha1';

/** Called when discovery could not answer for `group`, and the legacy version is used instead. */
export type OnDiscoveryUnknown = (group: string) => void;

/**
 * The base URL of `group`, or `undefined` when the server does not serve it in a supported version.
 * Discovery that cannot answer falls back to the legacy version instead of failing.
 */
export async function resolveMTApiBaseUrl(
  group: string,
  onDiscoveryUnknown: OnDiscoveryUnknown
): Promise<string | undefined> {
  const outcome = await resolveAPIBaseURLOutcome(group, SUPPORTED_VERSIONS);
  if (outcome.kind === 'known') {
    return outcome.value;
  }
  onDiscoveryUnknown(group);
  return getLegacyMTApiBaseUrl(group);
}

export function getLegacyMTApiBaseUrl(group: string): string {
  return toBaseURL(group, LEGACY_VERSION);
}

export interface FetchConnectionsOptions {
  /** Shared by every page request, so a newer fetch with the same id cancels the request in flight. */
  requestId: string;
  /** Checked before each page. A fetch that a newer one replaced stops and resolves `undefined`. */
  isCurrent: () => boolean;
  onDiscoveryUnknown: OnDiscoveryUnknown;
}

/** Every connection: the API returns at most 1000 per page, so this follows `metadata.continue`. */
export async function fetchConnections({
  requestId,
  isCurrent,
  onDiscoveryUnknown,
}: FetchConnectionsOptions): Promise<DataSourceConnectionList | undefined> {
  const baseUrl = await resolveMTApiBaseUrl(QUERY_GROUP, onDiscoveryUnknown);
  if (!baseUrl) {
    throw new Error(`DataSource: ${QUERY_GROUP} is not served in a supported version`);
  }

  const items: DataSourceConnection[] = [];
  let next: string | undefined;
  do {
    // A page request would cancel the newer fetch's request, because both use the same id.
    if (!isCurrent()) {
      return undefined;
    }
    const params = next ? { continue: next } : undefined;
    const page = await getBackendSrv().get<DataSourceConnectionList>(
      `${baseUrl}/connections`,
      params,
      requestId,
      REQUEST_OPTIONS
    );
    items.push(...(page.items ?? []));
    next = page.metadata?.continue;
  } while (next);
  return { items };
}

/**
 * `baseUrl` comes from {@link resolveMTApiBaseUrl}. Resolves `undefined` on a 404; every other
 * failure rejects with the `FetchError`.
 */
export async function fetchDataSourceResource(baseUrl: string, uid: string): Promise<DataSourceResource | undefined> {
  try {
    return await getBackendSrv().get<DataSourceResource>(
      `${baseUrl}/datasources/${encodeURIComponent(uid)}`,
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
