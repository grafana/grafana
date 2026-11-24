import { isObject } from '@grafana/data';

import { getFetchErrorContext } from '../../utils/getCachedPromise';
import { getBackendSrv, isFetchError } from '../backendSrv';
import { API_VERSION_PATTERN } from '../pluginUtils';
import { isSignedInOrAnonymous } from '../user';

import { logAPIDiscoveryError, logAPIDiscoveryWarning } from './logging';
import { fromK8sAPIResourceList, isK8sAPIResourceList, type ResourceList } from './resources';
import {
  type K8sAPIGroup,
  type K8sAPIGroupList,
  type APIGroupInfo,
  type APIResourceInfo,
  type APIResourceQuery,
} from './types';

/** `unknown` means discovery could not answer. It is never cached, so the next caller asks again. */
type Outcome<T> = { kind: 'known'; value: T } | { kind: 'unknown' };

type GroupsByName = ReadonlyMap<string, APIGroupInfo>;

/** A discovery request that takes longer counts as unknown, so callers are never held up for long. */
export const API_DISCOVERY_TIMEOUT_MS = 5_000;

const ROOT_URL = '/apis';
const UNKNOWN: Outcome<never> = { kind: 'unknown' };
// A DNS subdomain, as Kubernetes requires for group names. The name ends up in a URL path.
const GROUP_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

class DiscoveryTimeoutError extends Error {
  constructor(url: string) {
    super(`API discovery request to ${url} timed out after ${API_DISCOVERY_TIMEOUT_MS}ms`);
    this.name = 'DiscoveryTimeoutError';
  }
}

/** Shares one in-flight request per key and keeps only known outcomes. */
class OutcomeCache<T> {
  private readonly entries = new Map<string, Promise<Outcome<T>>>();

  peek(key: string): Promise<Outcome<T>> | undefined {
    return this.entries.get(key);
  }

  get(key: string, load: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
    const existing = this.entries.get(key);
    if (existing) {
      return existing;
    }

    const pending = load().then((outcome) => {
      // The identity check keeps an entry that invalidation or a test seed put here meanwhile.
      if (outcome.kind === 'unknown' && this.entries.get(key) === pending) {
        this.entries.delete(key);
      }
      return outcome;
    });
    this.entries.set(key, pending);
    return pending;
  }

  set(key: string, value: T): void {
    this.entries.set(key, Promise.resolve({ kind: 'known', value }));
  }

  clear(): void {
    this.entries.clear();
  }
}

const rootCache = new OutcomeCache<GroupsByName>();
const groupCache = new OutcomeCache<APIGroupInfo | undefined>();
const resourceListCache = new OutcomeCache<ResourceList | undefined>();

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
  if (!isValidGroupName(group)) {
    return undefined;
  }

  // A group answered by the fallback stays answered, so a broken root endpoint is not retried for it.
  const fromFallback = groupCache.peek(group);
  if (fromFallback) {
    return valueOf(await fromFallback);
  }

  const root = await rootCache.get(ROOT_URL, fetchAPIGroupList);
  if (root.kind === 'known') {
    return root.value.get(group);
  }

  return valueOf(await groupCache.get(group, () => fetchAPIGroup(group)));
}

/**
 * Returns the resources that one version of an `/apis` group serves, such as `dashboards` in
 * `dashboard.grafana.app/v1beta1`, in the order the server lists them.
 *
 * Resolves `undefined` when the server has no resource list for the group version, which is cached, or when
 * discovery can't answer, which is not cached (see {@link getAPIGroup}). A group version that serves routes
 * only, and no resources, has no resource list. It never rejects and never shows an error to the user.
 *
 * The first call for a group version fetches `GET /apis/<group>/<version>`. Later calls reuse the answer
 * until {@link invalidateAPIDiscovery} or a page reload.
 *
 * @alpha
 */
export async function getAPIResources(group: string, version: string): Promise<readonly APIResourceInfo[] | undefined> {
  return (await getResourceList(group, version))?.resources;
}

/**
 * Resolves `true` when a version of an `/apis` group serves a resource, and optionally a subresource and a
 * verb. A subresource has verbs of its own, so with a subresource the verb is checked on the subresource.
 *
 * Resolves `false` when it isn't served, and when discovery can't answer. It shares requests and answers
 * with {@link getAPIResources}. Like the rest of discovery, it says what the server serves, not what the
 * current user may do.
 *
 * The `health`, `resources` and `proxy` endpoints of an app plugin aren't registered subresources of its
 * `app` resource, so they resolve `false` even when the plugin serves them.
 *
 * @example
 * ```ts
 * const canCreate = await isAPIResourceAvailable({
 *   group: 'dashboard.grafana.app',
 *   version: 'v0alpha1',
 *   resource: 'librarypanels',
 *   verb: 'create',
 * });
 * ```
 *
 * @alpha
 */
export async function isAPIResourceAvailable({
  group,
  version,
  resource,
  subresource,
  verb,
}: APIResourceQuery): Promise<boolean> {
  const list = await getResourceList(group, version);
  const verbs = list?.verbs.get(subresource ? `${resource}/${subresource}` : resource);
  return verbs !== undefined && (!verb || verbs.includes(verb));
}

/**
 * Forgets every cached discovery answer, so the next call asks the server again. Call it after
 * something changes which groups the server serves, such as installing or removing an app plugin.
 *
 * @alpha
 */
export function invalidateAPIDiscovery(): void {
  rootCache.clear();
  groupCache.clear();
  resourceListCache.clear();
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
  rootCache.set(ROOT_URL, new Map(groups.map((info) => [info.group, info])));
}

function valueOf<T>(outcome: Outcome<T | undefined>): T | undefined {
  return outcome.kind === 'known' ? outcome.value : undefined;
}

async function fetchAPIGroupList(): Promise<Outcome<GroupsByName>> {
  if (!isSignedInOrAnonymous()) {
    return UNKNOWN;
  }

  try {
    const response = await getWithTimeout(ROOT_URL);
    if (!isK8sAPIGroupList(response)) {
      throw new Error('API discovery: the response is not an APIGroupList');
    }

    const infos = response.groups.map(toAPIGroupInfo).filter((info) => info !== undefined);
    return { kind: 'known', value: new Map(infos.map((info) => [info.group, info])) };
  } catch (error) {
    logRequestFailure(ROOT_URL, error);
    return UNKNOWN;
  }
}

async function fetchAPIGroup(group: string): Promise<Outcome<APIGroupInfo | undefined>> {
  if (!isSignedInOrAnonymous()) {
    return UNKNOWN;
  }

  const url = `${ROOT_URL}/${group}/`;
  try {
    const response = await getWithTimeout(url);
    if (!isK8sAPIGroup(response)) {
      throw new Error('API discovery: the response is not an APIGroup');
    }
    return { kind: 'known', value: toAPIGroupInfo(response) };
  } catch (error) {
    if (isFetchError(error) && error.status === 404) {
      return { kind: 'known', value: undefined };
    }
    logRequestFailure(url, error);
    return UNKNOWN;
  }
}

function isValidGroupName(group: string): boolean {
  if (GROUP_NAME_PATTERN.test(group)) {
    return true;
  }
  logAPIDiscoveryWarning('API discovery: not a valid API group name, such as dashboard.grafana.app', { group });
  return false;
}

async function getResourceList(group: string, version: string): Promise<ResourceList | undefined> {
  if (!isValidGroupName(group)) {
    return undefined;
  }
  if (!API_VERSION_PATTERN.test(version)) {
    logAPIDiscoveryWarning('API discovery: not a valid API version, such as v1beta1', { group, version });
    return undefined;
  }
  return valueOf(await resourceListCache.get(`${group}/${version}`, () => fetchResourceList(group, version)));
}

async function fetchResourceList(group: string, version: string): Promise<Outcome<ResourceList | undefined>> {
  if (!isSignedInOrAnonymous()) {
    return UNKNOWN;
  }

  const url = `${ROOT_URL}/${group}/${version}`;
  try {
    const response = await getWithTimeout(url);
    if (!isK8sAPIResourceList(response)) {
      throw new Error('API discovery: the response is not an APIResourceList');
    }
    return { kind: 'known', value: fromK8sAPIResourceList(group, version, response) };
  } catch (error) {
    if (isFetchError(error) && error.status === 404) {
      return { kind: 'known', value: undefined };
    }
    logRequestFailure(url, error);
    return UNKNOWN;
  }
}

async function getWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Racing the request, rather than relying on the abort alone, settles even if the request ignores the signal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DiscoveryTimeoutError(url));
    }, API_DISCOVERY_TIMEOUT_MS);
  });

  try {
    const request = getBackendSrv().get<unknown>(url, undefined, undefined, {
      showErrorAlert: false,
      abortSignal: controller.signal,
    });
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function logRequestFailure(url: string, error: unknown): void {
  const timedOut = error instanceof DiscoveryTimeoutError;
  logAPIDiscoveryError('API discovery: request failed', error, {
    ...getFetchErrorContext(error),
    url,
    reason: timedOut ? 'timeout' : 'error',
  });
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

function isK8sAPIGroupList(value: unknown): value is K8sAPIGroupList {
  return isObject(value) && 'groups' in value && Array.isArray(value.groups) && value.groups.every(isK8sAPIGroup);
}

function isK8sAPIGroup(value: unknown): value is K8sAPIGroup {
  return (
    isObject(value) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'versions' in value &&
    Array.isArray(value.versions) &&
    value.versions.every((v) => isObject(v) && 'version' in v && typeof v.version === 'string')
  );
}
