import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

/** The dashboard API version the pending changes preview reads. */
function dashboardsURL() {
  return `/apis/dashboard.grafana.app/${dashboardAPIVersionResolver.getV2()}/namespaces/${getAPINamespace()}/dashboards`;
}

export interface SavedDashboard {
  title: string;
  generation: number;
  canEdit: boolean;
  url: string;
  spec: unknown;
}

/**
 * A dashboard uid as one path segment. The uid comes from the route, so anything else (a `/`, `..`,
 * or another character a uid can't have) would change the request's path.
 */
function uidSegment(uid: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(uid) || uid === '.' || uid === '..') {
    throw new Error(`Invalid dashboard uid: ${uid}`);
  }
  return uid;
}

/**
 * A saved dashboard with the requester's access to it. The spec is the stored one, not the
 * DTO's, which adds defaults (such as the built-in annotation) a stored spec doesn't have.
 */
export async function getSavedDashboard(uid: string): Promise<SavedDashboard> {
  const segment = uidSegment(uid);
  const [resource, dto] = await Promise.all([
    getBackendSrv().get<{ metadata: { generation?: number }; spec: { title?: string } }>(
      `${dashboardsURL()}/${segment}`,
      undefined,
      undefined,
      { showErrorAlert: false }
    ),
    getBackendSrv().get<{ access?: { canEdit?: boolean; url?: string } }>(
      `${dashboardsURL()}/${segment}/dto`,
      undefined,
      undefined,
      { showErrorAlert: false }
    ),
  ]);
  return {
    title: resource.spec?.title ?? uid,
    generation: resource.metadata?.generation ?? 0,
    canEdit: Boolean(dto.access?.canEdit),
    url: dto.access?.url ?? `/d/${uid}`,
    spec: resource.spec,
  };
}

/** The spec of a dashboard at a past generation; rejects when history no longer has it. */
export async function getDashboardSpecAtGeneration(uid: string, generation: number): Promise<unknown> {
  // Pages through the whole history: a version can be well past the first page.
  const [version] = await (await getDashboardAPI('v2')).getDashboardHistoryVersions(uid, [generation]);
  return version?.spec;
}
