import { t } from '@grafana/i18n';

import { type DashboardScene } from '../scene/DashboardScene';

// Keep in sync with pkg/apimachinery/utils/meta.go.
export const LabelKeyLifecycle = 'grafana.app/lifecycle';
export const LabelKeyLifecycleOwner = 'grafana.app/lifecycle-owner';
export const LabelKeyForkOf = 'grafana.app/fork-of';
export const AnnoKeyForkBase = 'grafana.app/fork-base';
export const AnnoKeyOrigin = 'grafana.app/origin';
export const AnnoKeyOriginRef = 'grafana.app/origin-ref';
export const AnnoKeyUpdatedTimestamp = 'grafana.app/updatedTimestamp';

export type DashboardLifecycle = 'draft' | 'fork' | 'published';

export interface DashboardLifecycleInfo {
  lifecycle: DashboardLifecycle;
  /** Name of the dashboard a fork was created from. */
  forkOf?: string;
  /** Generation of the original the fork is based on. */
  forkBase?: number;
  /** Product that created the draft or fork, for display ("assistant"). */
  origin?: string;
  originRef?: string;
  /** Last write, used for the expiry hint. */
  updatedAt?: Date;
}

interface LifecycleMeta {
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
}

export function lifecycleFromMetadata(meta: LifecycleMeta | undefined): DashboardLifecycleInfo {
  const labels = meta?.labels ?? {};
  const annotations = meta?.annotations ?? {};
  const value = labels[LabelKeyLifecycle];
  const lifecycle: DashboardLifecycle = value === 'draft' || value === 'fork' ? value : 'published';
  const base = Number(annotations[AnnoKeyForkBase]);
  const updated = annotations[AnnoKeyUpdatedTimestamp] ?? meta?.creationTimestamp;
  return {
    lifecycle,
    forkOf: lifecycle === 'fork' ? labels[LabelKeyForkOf] : undefined,
    forkBase: Number.isFinite(base) && base > 0 ? base : undefined,
    origin: annotations[AnnoKeyOrigin],
    originRef: annotations[AnnoKeyOriginRef],
    updatedAt: updated ? new Date(updated) : undefined,
  };
}

export function getDashboardLifecycle(dashboard: DashboardScene): DashboardLifecycleInfo {
  return lifecycleFromMetadata(dashboard.state.meta.k8s);
}

/** Days until an idle draft or fork moves to Recently deleted, for the default 30-day window. */
export const DRAFT_IDLE_DAYS = 30;

export function daysUntilExpiry(updatedAt: Date | undefined, now = new Date()): number | undefined {
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
    return undefined;
  }
  const elapsed = (now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(DRAFT_IDLE_DAYS - elapsed));
}

/** Label shown next to the dashboard title in the breadcrumbs. */
export function getLifecycleBreadcrumbLabel(labels: Record<string, string> | undefined): string | undefined {
  switch (labels?.[LabelKeyLifecycle]) {
    case 'draft':
      return t('dashboard-scene.lifecycle.breadcrumb-draft', 'Draft');
    case 'fork':
      return t('dashboard-scene.lifecycle.breadcrumb-fork', 'Fork');
    default:
      return undefined;
  }
}
