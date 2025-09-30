import { getBackendSrv } from '@grafana/runtime';

export type ResourceType = 'dashboard' | 'folder' | 'alert';

/**
 * Records a visit to a resource (dashboard, folder, or alert rule) for analytics purposes.
 * Failures are silently logged to console to avoid disrupting user experience.
 */
export async function recordResourceVisit(resourceUid: string, resourceType: ResourceType): Promise<void> {
  try {
    const response = await getBackendSrv().post(`/api/resources/${resourceType}/${resourceUid}/visit`);
    // Log success to console instead of showing notifications
    console.log(`Visit recorded for ${resourceType}: ${resourceUid}`, response);
  } catch (error) {
    // Silently fail - visit tracking shouldn't break navigation
    console.debug('Failed to record resource visit:', error);
  }
}
