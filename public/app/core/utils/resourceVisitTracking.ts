import { getBackendSrv } from '@grafana/runtime';

export type ResourceType = 'dashboard' | 'folder' | 'alert';

/**
 * Records a visit to a resource (dashboard, folder, or alert rule) for analytics purposes.
 * Failures are silent to avoid disrupting user experience.
 */
export async function recordResourceVisit(resourceUid: string, resourceType: ResourceType): Promise<void> {
  try {
    await getBackendSrv().post(`/api/resources/${resourceType}/${resourceUid}/visit`);
    // Visit recorded silently - no logging to keep console clean
  } catch (error) {
    // Silently fail - visit tracking shouldn't break navigation or log errors
  }
}
