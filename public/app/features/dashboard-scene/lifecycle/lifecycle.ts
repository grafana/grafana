import { t } from '@grafana/i18n';

import { type DashboardScene } from '../scene/DashboardScene';

// Keep in sync with pkg/apimachinery/utils/meta.go.
export const LabelKeyLifecycle = 'grafana.app/lifecycle';
export const LabelKeyLifecycleOwner = 'grafana.app/lifecycle-owner';
export const AnnoKeyOrigin = 'grafana.app/origin';
export const AnnoKeyOriginRef = 'grafana.app/origin-ref';
export const AnnoKeyUpdatedTimestamp = 'grafana.app/updatedTimestamp';

export type DashboardLifecycle = 'draft' | 'published';

export interface DashboardLifecycleInfo {
  lifecycle: DashboardLifecycle;
  /** Product that created the draft, for display ("assistant"). */
  origin?: string;
  originRef?: string;
  /** Last write, used for the expiry hint. */
  updatedAt?: Date;
}

interface LifecycleMeta {
  labels?: Record<string, string>;
  // Wider than strings: the scene's k8s metadata types a few client annotations as booleans.
  annotations?: Partial<Record<string, unknown>>;
  creationTimestamp?: string;
}

function stringAnnotation(annotations: Partial<Record<string, unknown>>, key: string): string | undefined {
  const value = annotations[key];
  return typeof value === 'string' ? value : undefined;
}

export function lifecycleFromMetadata(meta: LifecycleMeta | undefined): DashboardLifecycleInfo {
  const labels = meta?.labels ?? {};
  const annotations = meta?.annotations ?? {};
  const value = labels[LabelKeyLifecycle];
  const lifecycle: DashboardLifecycle = value === 'draft' ? 'draft' : 'published';
  const updated = stringAnnotation(annotations, AnnoKeyUpdatedTimestamp) ?? meta?.creationTimestamp;
  return {
    lifecycle,
    origin: stringAnnotation(annotations, AnnoKeyOrigin),
    originRef: stringAnnotation(annotations, AnnoKeyOriginRef),
    updatedAt: updated ? new Date(updated) : undefined,
  };
}

export function getDashboardLifecycle(dashboard: DashboardScene): DashboardLifecycleInfo {
  return lifecycleFromMetadata(dashboard.state.meta.k8s);
}

/** Days until an idle draft moves to Recently deleted, or idle pending changes are discarded. */
export const DRAFT_IDLE_DAYS = 30;

export function daysUntilExpiry(updatedAt: Date | undefined, now = new Date()): number | undefined {
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
    return undefined;
  }
  const elapsed = (now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(DRAFT_IDLE_DAYS - elapsed));
}

/** Label shown next to the dashboard title in the breadcrumbs. */
export function getLifecycleBreadcrumbLabel(
  labels: Record<string, string> | undefined,
  previewingPendingChanges = false
): string | undefined {
  if (labels?.[LabelKeyLifecycle] === 'draft') {
    return t('dashboard-scene.lifecycle.breadcrumb-draft', 'Draft');
  }
  return previewingPendingChanges
    ? t('dashboard-scene.lifecycle.breadcrumb-pending-changes', 'Pending changes')
    : undefined;
}
