import { ANNOTATION_API_GROUP } from 'app/api/clients/annotation/v0alpha1/types';
import { getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';

// Resolved once per page load. The set of registered API groups is effectively
// static for the apiserver process lifetime, so we don't re-fetch on every
// annotation operation. Failures are not cached so a transient outage can be
// retried by the next caller.
let cached: Promise<boolean> | undefined;

export function isAnnotationApiAvailable(): Promise<boolean> {
  if (cached) {
    return cached;
  }

  const pending = getAPIGroupDiscoveryList().then((apis) =>
    apis.items.some((group) => group.metadata.name === ANNOTATION_API_GROUP)
  );

  const result = pending.catch(() => false);
  cached = result;

  pending.catch(() => {
    if (cached === result) {
      cached = undefined;
    }
  });

  return result;
}
