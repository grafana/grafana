import { API_GROUP } from '@grafana/api-clients/rtkq/rules.alerting/v1beta1';
import { getBackendSrv } from '@grafana/runtime';

export type RulesAPIVersion = 'v1beta1' | 'v0alpha1';

// Every backend that serves the rules API group serves v0alpha1, so it is the safe choice
// when discovery can't tell us whether v1beta1 is there.
const FALLBACK_VERSION: RulesAPIVersion = 'v0alpha1';

interface K8sAPIGroup {
  versions: Array<{ version: string }>;
}

// The frontend can be deployed ahead of a backend that only serves v0alpha1. The served versions
// are static for the apiserver process lifetime, so resolve once per page load. Failures are not
// cached so a transient outage is retried by the next caller.
let resolved: Promise<RulesAPIVersion> | undefined;

export function resolveRulesAPIVersion(): Promise<RulesAPIVersion> {
  if (resolved) {
    return resolved;
  }

  const pending = getBackendSrv()
    .get<K8sAPIGroup>(`/apis/${API_GROUP}/`, undefined, undefined, { showErrorAlert: false })
    .then((group): RulesAPIVersion => (group.versions.some((v) => v.version === 'v1beta1') ? 'v1beta1' : 'v0alpha1'));

  const result = pending.catch(() => FALLBACK_VERSION);
  resolved = result;

  pending.catch(() => {
    if (resolved === result) {
      resolved = undefined;
    }
  });

  return result;
}

/** @internal Testing only */
export function resetRulesAPIVersion(): void {
  resolved = undefined;
}

export function rulesAPIGroupVersion(version: RulesAPIVersion): string {
  return `${API_GROUP}/${version}`;
}
