import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { type Resource } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';

import { type DashboardLifecycleInfo } from './lifecycle';

/** The dashboard API version lifecycle operations use; merges and publishes write through it. */
function dashboardsURL() {
  return `/apis/dashboard.grafana.app/${dashboardAPIVersionResolver.getV2()}/namespaces/${getAPINamespace()}/dashboards`;
}

function searchURL() {
  return `/apis/dashboard.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/search`;
}

export type LifecycleResource = Resource<Record<string, unknown>>;

export interface MergeConflict {
  baseGeneration: number;
  currentGeneration: number;
}

/** Reads the merge-conflict details the merge subresource returns with HTTP 409. */
export function mergeConflictFromError(err: unknown): MergeConflict | undefined {
  if (!err || typeof err !== 'object' || !('status' in err) || err.status !== 409 || !('data' in err)) {
    return undefined;
  }
  const data = err.data;
  if (!data || typeof data !== 'object' || !('details' in data)) {
    return undefined;
  }
  const details = data.details;
  const causes = details && typeof details === 'object' && 'causes' in details ? details.causes : undefined;
  if (!Array.isArray(causes)) {
    return undefined;
  }
  const value = (type: string) => {
    // Kubernetes serializes StatusCause.Type as "reason".
    const cause = causes.find((c) => c && typeof c === 'object' && 'reason' in c && c.reason === type);
    return cause && 'message' in cause ? Number(cause.message) : NaN;
  };
  const baseGeneration = value('baseGeneration');
  const currentGeneration = value('currentGeneration');
  return Number.isFinite(baseGeneration) && Number.isFinite(currentGeneration)
    ? { baseGeneration, currentGeneration }
    : undefined;
}

export function getDashboardResource(uid: string): Promise<LifecycleResource> {
  return getBackendSrv().get(`${dashboardsURL()}/${uid}`, undefined, undefined, { showErrorAlert: false });
}

export interface OriginalDashboard {
  title: string;
  generation: number;
  canEdit: boolean;
  url: string;
  spec: unknown;
}

/** The original of a fork with the requester's access to it. */
export async function getDashboardDTO(uid: string): Promise<OriginalDashboard> {
  const dto = await getBackendSrv().get<{
    metadata: { generation?: number };
    spec: { title?: string };
    access?: { canEdit?: boolean; url?: string };
  }>(`${dashboardsURL()}/${uid}/dto`, undefined, undefined, { showErrorAlert: false });
  return {
    title: dto.spec?.title ?? uid,
    generation: dto.metadata?.generation ?? 0,
    canEdit: Boolean(dto.access?.canEdit),
    url: dto.access?.url ?? `/d/${uid}`,
    spec: dto.spec,
  };
}

/** The spec of a dashboard at a past generation, if history still has it. */
export async function getDashboardSpecAtGeneration(uid: string, generation: number): Promise<unknown | undefined> {
  const list = await getBackendSrv().get<{ items?: Array<{ metadata: { generation?: number }; spec: unknown }> }>(
    dashboardsURL(),
    { labelSelector: 'grafana.app/get-history=true', fieldSelector: `metadata.name=${uid}`, limit: 100 },
    undefined,
    { showErrorAlert: false }
  );
  return list.items?.find((item) => item.metadata.generation === generation)?.spec;
}

export function publishDraft(uid: string, body: { folder?: string; title?: string }): Promise<LifecycleResource> {
  return getBackendSrv().post(`${dashboardsURL()}/${uid}/publish`, body);
}

export function mergeFork(uid: string, body: { force?: boolean }): Promise<LifecycleResource> {
  return getBackendSrv().post(`${dashboardsURL()}/${uid}/merge`, body, { showErrorAlert: false });
}

export function discardDashboard(uid: string): Promise<unknown> {
  return getBackendSrv().delete(`${dashboardsURL()}/${uid}`);
}

export interface ForkSummary {
  uid: string;
  title: string;
}

/** The requester's own forks of a dashboard. */
export async function listMyForksOf(uid: string): Promise<ForkSummary[]> {
  const res = await getBackendSrv().get<{ hits?: Array<{ name: string; title: string }> }>(
    searchURL(),
    { forkOf: uid, type: 'dashboard', limit: 20 },
    undefined,
    { showErrorAlert: false }
  );
  return (res.hits ?? []).map((hit) => ({ uid: hit.name, title: hit.title }));
}

export interface LifecycleListItem extends ForkSummary {
  lifecycle: DashboardLifecycleInfo['lifecycle'];
  forkOf?: string;
  folder?: string;
}

/** The requester's own drafts and forks. */
export async function listMyDraftsAndForks(): Promise<LifecycleListItem[]> {
  const res = await getBackendSrv().get<{
    hits?: Array<{ name: string; title: string; folder?: string; field?: Record<string, unknown> }>;
  }>(searchURL(), {
    lifecycle: 'draft,fork',
    type: 'dashboard',
    limit: 200,
    field: ['labels.grafana.app/lifecycle', 'labels.grafana.app/fork-of'],
  });
  return (res.hits ?? []).map((hit) => {
    const lifecycle = hit.field?.['labels.grafana.app/lifecycle'];
    const forkOf = hit.field?.['labels.grafana.app/fork-of'];
    return {
      uid: hit.name,
      title: hit.title,
      folder: hit.folder,
      lifecycle: lifecycle === 'fork' ? 'fork' : 'draft',
      forkOf: typeof forkOf === 'string' ? forkOf : undefined,
    };
  });
}
