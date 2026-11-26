import { isObject } from '@grafana/data';
import { config, getAPIGroup as stableGetAPIGroup, getBackendSrv } from '@grafana/runtime';

import { type APIGroupInfo } from './types';

// A DNS subdomain, as Kubernetes requires for group names. The name ends up in a URL path.
const GROUP_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const inFlight = new Map<string, Promise<APIGroupInfo | undefined>>();

interface K8sAPIGroup {
  name: string;
  versions: Array<{ version: string }>;
  preferredVersion?: { version: string };
}

/**
 * Returns the versions the server serves for an `/apis` group, such as `dashboard.grafana.app`.
 * Resolves `undefined` when the group isn't served or discovery can't answer. Never rejects.
 */
export async function getAPIGroup(group: string): Promise<APIGroupInfo | undefined> {
  if (typeof stableGetAPIGroup === 'function') {
    return stableGetAPIGroup(group);
  }

  return backwardsCompatibleGetAPIGroup(group);
}

// Unlike the host service, this caches nothing: without the host there is nothing to invalidate it
// when plugins are installed, so only concurrent calls share a request.
function backwardsCompatibleGetAPIGroup(group: string): Promise<APIGroupInfo | undefined> {
  if (!GROUP_NAME_PATTERN.test(group) || !hasUserSession()) {
    return Promise.resolve(undefined);
  }

  const existing = inFlight.get(group);
  if (existing) {
    return existing;
  }

  const request = fetchAPIGroup(group).finally(() => inFlight.delete(group));
  inFlight.set(group, request);
  return request;
}

// `/apis` needs a signed-in or anonymous user, both of which have an org role.
function hasUserSession(): boolean {
  return Boolean(config.bootData.user?.orgRole);
}

async function fetchAPIGroup(group: string): Promise<APIGroupInfo | undefined> {
  try {
    const response = await getBackendSrv().get<unknown>(`/apis/${group}/`, undefined, undefined, {
      showErrorAlert: false,
    });
    return isK8sAPIGroup(response) ? toAPIGroupInfo(response) : undefined;
  } catch {
    return undefined;
  }
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
