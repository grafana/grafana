import { getFetchErrorContext } from '../../utils/getCachedPromise';
import { getBackendSrv, isFetchError } from '../backendSrv';
import { isSignedInOrAnonymous } from '../user';

import { logApiDiscoveryError } from './logging';
import { type APIGroup, type APIGroupList, type ApiGroupInfo } from './types';

/** `unknown` means discovery could not answer. It is never cached, so the next caller asks again. */
type Outcome<T> = { kind: 'known'; value: T } | { kind: 'unknown' };

type GroupsByName = ReadonlyMap<string, ApiGroupInfo>;

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
const groupCache = new OutcomeCache<ApiGroupInfo | undefined>();

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
 * The first call fetches `GET /apis`. Later calls reuse the answer until {@link invalidateApiDiscovery}
 * or a page reload.
 *
 * @alpha
 */
export async function getApiGroup(group: string): Promise<ApiGroupInfo | undefined> {
  if (!GROUP_NAME_PATTERN.test(group)) {
    return undefined;
  }

  // A group answered by the fallback stays answered, so a broken root endpoint is not retried for it.
  const fromFallback = groupCache.peek(group);
  if (fromFallback) {
    return valueOf(await fromFallback);
  }

  const root = await rootCache.get(ROOT_URL, fetchApiGroupList);
  if (root.kind === 'known') {
    return root.value.get(group);
  }

  return valueOf(await groupCache.get(group, () => fetchApiGroup(group)));
}

/**
 * Forgets every cached discovery answer, so the next call asks the server again. Call it after
 * something changes which groups the server serves, such as installing or removing an app plugin.
 *
 * @alpha
 */
export function invalidateApiDiscovery(): void {
  rootCache.clear();
  groupCache.clear();
}

/**
 * Makes discovery answer from `groups` without requests or a session, until `invalidateApiDiscovery()`.
 *
 * @internal
 */
export function setApiDiscoveryForTesting(groups: readonly ApiGroupInfo[]): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setApiDiscoveryForTesting function can only be called from tests.');
  }

  invalidateApiDiscovery();
  rootCache.set(ROOT_URL, new Map(groups.map((info) => [info.group, info])));
}

function valueOf<T>(outcome: Outcome<T | undefined>): T | undefined {
  return outcome.kind === 'known' ? outcome.value : undefined;
}

async function fetchApiGroupList(): Promise<Outcome<GroupsByName>> {
  if (!isSignedInOrAnonymous()) {
    return UNKNOWN;
  }

  try {
    const response = await getWithTimeout(ROOT_URL);
    if (!isAPIGroupList(response)) {
      throw new Error('API discovery: the response is not an APIGroupList');
    }

    const infos = response.groups.map(toApiGroupInfo).filter((info) => info !== undefined);
    return { kind: 'known', value: new Map(infos.map((info) => [info.group, info])) };
  } catch (error) {
    logRequestFailure(ROOT_URL, error);
    return UNKNOWN;
  }
}

async function fetchApiGroup(group: string): Promise<Outcome<ApiGroupInfo | undefined>> {
  if (!isSignedInOrAnonymous()) {
    return UNKNOWN;
  }

  const url = `${ROOT_URL}/${group}/`;
  try {
    const response = await getWithTimeout(url);
    if (!isAPIGroup(response)) {
      throw new Error('API discovery: the response is not an APIGroup');
    }
    return { kind: 'known', value: toApiGroupInfo(response) };
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
  logApiDiscoveryError('API discovery: request failed', error, {
    ...getFetchErrorContext(error),
    url,
    reason: timedOut ? 'timeout' : 'error',
  });
}

function toApiGroupInfo(apiGroup: APIGroup): ApiGroupInfo | undefined {
  const versions = apiGroup.versions.map(({ version }) => version);
  if (versions.length === 0) {
    return undefined;
  }
  // Kubernetes lists versions in order of preference, so the first one stands in for a missing preferredVersion.
  const preferredVersion = apiGroup.preferredVersion?.version ?? versions[0];
  return { group: apiGroup.name, versions, preferredVersion };
}

function isAPIGroupList(value: unknown): value is APIGroupList {
  return isObject(value) && Array.isArray(value.groups) && value.groups.every(isAPIGroup);
}

function isAPIGroup(value: unknown): value is APIGroup {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.versions) &&
    value.versions.every((v) => isObject(v) && typeof v.version === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
