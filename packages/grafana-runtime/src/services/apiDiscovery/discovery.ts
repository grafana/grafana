import { lastValueFrom, timeout, TimeoutError } from 'rxjs';

import { isObject } from '@grafana/data';

import {
  getCachedPromise,
  getFetchErrorContext,
  invalidateCachedPromise,
  replaceCachedPromise,
} from '../../utils/getCachedPromise';
import { getBackendSrv, isFetchError } from '../backendSrv';
import { isSignedInOrAnonymous, NoUserSessionError } from '../user';

import { logAPIDiscoveryError, logAPIDiscoveryWarning } from './logging';
import { type K8sAPIGroup, type K8sAPIGroupList, type APIGroupInfo } from './types';

type GroupsByName = ReadonlyMap<string, APIGroupInfo>;

/** A discovery request that takes longer counts as unknown, so callers are never held up for long. */
export const API_DISCOVERY_TIMEOUT_MS = 5_000;

const ROOT_URL = '/apis';
const ROOT_CACHE_KEY = 'grafana-runtime:api-discovery:root';
// A DNS subdomain, as Kubernetes requires for group names. The name ends up in a URL path.
const GROUP_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

// Groups with a pending or cached group-endpoint answer. Lookups for them skip `/apis`, so a broken root
// endpoint isn't retried on every call, and invalidation uses them to find their cache entries.
const groupsFromFallback = new Set<string>();

/**
 * Rejects the cached request after the failure is logged with its URL and reason. The rejection keeps
 * the unknown answer out of the cache, and `isHandled` stops `getCachedPromise` from logging it again.
 */
class DiscoveryRequestError extends Error {
  readonly isHandled = true;

  constructor(url: string, cause: unknown) {
    super(`API discovery: request to ${url} failed`, { cause });
    this.name = 'DiscoveryRequestError';
  }
}

/**
 * Returns the versions the server serves for an `/apis` group, such as `dashboard.grafana.app`.
 *
 * Resolves `undefined` in two cases you can't tell apart:
 * - **Not served**: the server doesn't list the group, or answers 404 for it. This is cached.
 * - **Unknown**: there is no user session (e.g. a public dashboard), or the request failed or timed
 *   out. This is not cached, so a later call asks the server again.
 *
 * It never rejects and never shows an error to the user. It says what the server serves, not what the
 * current user may do, so a request to a served group can still fail with a 403. What to do on
 * `undefined`, such as calling a legacy API, is up to the caller.
 *
 * The first call fetches `GET /apis`. Later calls reuse the answer until {@link invalidateAPIDiscovery}
 * or a page reload.
 *
 * @alpha
 */
export async function getAPIGroup(group: string): Promise<APIGroupInfo | undefined> {
  if (!GROUP_NAME_PATTERN.test(group)) {
    logAPIDiscoveryWarning('API discovery: not a valid API group name, such as dashboard.grafana.app', { group });
    return undefined;
  }

  if (groupsFromFallback.has(group)) {
    return getAPIGroupFromFallback(group);
  }

  try {
    const groups = await getCachedPromise(fetchAPIGroupList, { cacheKey: ROOT_CACHE_KEY });
    return groups.get(group);
  } catch {
    return getAPIGroupFromFallback(group);
  }
}

/**
 * Forgets every cached discovery answer, so the next call asks the server again. Call it after
 * something changes which groups the server serves, such as installing or removing an app plugin.
 *
 * @alpha
 */
export function invalidateAPIDiscovery(): void {
  invalidateCachedPromise(ROOT_CACHE_KEY);
  for (const group of groupsFromFallback) {
    invalidateCachedPromise(groupCacheKey(group));
  }
  groupsFromFallback.clear();
}

/**
 * Makes discovery answer from `groups` without requests or a session, until `invalidateAPIDiscovery()`.
 *
 * @internal
 */
export function setAPIDiscoveryForTesting(groups: readonly APIGroupInfo[]): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setAPIDiscoveryForTesting function can only be called from tests.');
  }

  invalidateAPIDiscovery();
  replaceCachedPromise(ROOT_CACHE_KEY, new Map(groups.map((info) => [info.group, info])));
}

function groupCacheKey(group: string): string {
  return `grafana-runtime:api-discovery:group:${group}`;
}

async function getAPIGroupFromFallback(group: string): Promise<APIGroupInfo | undefined> {
  groupsFromFallback.add(group);
  try {
    return await getCachedPromise(() => fetchAPIGroup(group), { cacheKey: groupCacheKey(group) });
  } catch {
    groupsFromFallback.delete(group);
    return undefined;
  }
}

async function fetchAPIGroupList(): Promise<GroupsByName> {
  if (!isSignedInOrAnonymous()) {
    throw new NoUserSessionError();
  }

  try {
    const response = await getWithTimeout(ROOT_URL);
    if (!isK8sAPIGroupList(response)) {
      throw new Error('API discovery: the response is not an APIGroupList');
    }

    const infos = response.groups.map(toAPIGroupInfo).filter((info) => info !== undefined);
    return new Map(infos.map((info) => [info.group, info]));
  } catch (error) {
    throw logRequestFailure(ROOT_URL, error);
  }
}

async function fetchAPIGroup(group: string): Promise<APIGroupInfo | undefined> {
  if (!isSignedInOrAnonymous()) {
    throw new NoUserSessionError();
  }

  const url = `${ROOT_URL}/${group}/`;
  try {
    const response = await getWithTimeout(url);
    if (!isK8sAPIGroup(response)) {
      throw new Error('API discovery: the response is not an APIGroup');
    }
    return toAPIGroupInfo(response);
  } catch (error) {
    if (isFetchError(error) && error.status === 404) {
      return undefined;
    }
    throw logRequestFailure(url, error);
  }
}

async function getWithTimeout(url: string): Promise<unknown> {
  // On the deadline, `timeout` errors and unsubscribes, which cancels the request.
  const { data } = await lastValueFrom(
    getBackendSrv()
      .fetch<unknown>({ url, method: 'GET', showErrorAlert: false, validatePath: true })
      .pipe(timeout(API_DISCOVERY_TIMEOUT_MS))
  );
  return data;
}

function logRequestFailure(url: string, error: unknown): DiscoveryRequestError {
  const timedOut = error instanceof TimeoutError;
  logAPIDiscoveryError('API discovery: request failed', error, {
    ...getFetchErrorContext(error),
    url,
    reason: timedOut ? 'timeout' : 'error',
  });
  return new DiscoveryRequestError(url, error);
}

function toAPIGroupInfo(apiGroup: K8sAPIGroup): APIGroupInfo | undefined {
  const versions = apiGroup.versions.map(({ version }) => version);
  if (versions.length === 0) {
    return undefined;
  }
  // Kubernetes lists versions in order of preference, so the first one stands in for a missing preferredVersion.
  const preferredVersion = apiGroup.preferredVersion?.version ?? versions[0];
  return { group: apiGroup.name, versions, preferredVersion };
}

// Only the top level is checked. A malformed group makes the parsing throw, which is logged as unknown.
function isK8sAPIGroupList(value: unknown): value is K8sAPIGroupList {
  return isObject(value) && 'groups' in value && Array.isArray(value.groups);
}

function isK8sAPIGroup(value: unknown): value is K8sAPIGroup {
  return isObject(value) && 'versions' in value && Array.isArray(value.versions);
}
