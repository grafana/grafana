import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { type Resource } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

/** The dashboard API version lifecycle operations use; publishes write through it. */
function dashboardsURL() {
  return `/apis/dashboard.grafana.app/${dashboardAPIVersionResolver.getV2()}/namespaces/${getAPINamespace()}/dashboards`;
}

function searchURL() {
  return `/apis/dashboard.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/search`;
}

export type LifecycleResource = Resource<Record<string, unknown>>;

export interface SavedDashboard {
  title: string;
  generation: number;
  canEdit: boolean;
  url: string;
  spec: unknown;
}

/**
 * A saved dashboard with the requester's access to it. The spec is the stored one, not the
 * DTO's, which adds defaults (such as the built-in annotation) a stored spec doesn't have.
 */
export async function getSavedDashboard(uid: string): Promise<SavedDashboard> {
  const [resource, dto] = await Promise.all([
    getBackendSrv().get<{ metadata: { generation?: number }; spec: { title?: string } }>(
      `${dashboardsURL()}/${uid}`,
      undefined,
      undefined,
      { showErrorAlert: false }
    ),
    getBackendSrv().get<{ access?: { canEdit?: boolean; url?: string } }>(
      `${dashboardsURL()}/${uid}/dto`,
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

export function publishDraft(uid: string, body: { folder?: string; title?: string }): Promise<LifecycleResource> {
  return getBackendSrv().post(`${dashboardsURL()}/${uid}/publish`, body);
}

export function discardDashboard(uid: string): Promise<unknown> {
  return getBackendSrv().delete(`${dashboardsURL()}/${uid}`);
}

export interface DraftListItem {
  uid: string;
  title: string;
  folder?: string;
  /** Epoch milliseconds. */
  created?: number;
  /** Epoch milliseconds of the last edit; its creation until a draft is edited. */
  updated?: number;
}

/** The requester's own drafts, most recently edited first. */
export async function listMyDrafts(): Promise<DraftListItem[]> {
  const res = await getBackendSrv().get<{
    hits?: Array<{ name: string; title: string; folder?: string; field?: { created?: number; updated?: number } }>;
  }>(searchURL(), { lifecycle: 'draft', type: 'dashboard', limit: 200, field: ['created', 'updated'] });
  return (res.hits ?? [])
    .map((hit) => ({
      uid: hit.name,
      title: hit.title,
      folder: hit.folder,
      created: hit.field?.created || undefined,
      // Search reports 0 for a draft not edited since it was created.
      updated: hit.field?.updated || hit.field?.created,
    }))
    .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
}
