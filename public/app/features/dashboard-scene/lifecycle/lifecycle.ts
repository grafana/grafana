import { t } from '@grafana/i18n';

/** Label shown next to the dashboard title in the breadcrumbs while it shows pending changes. */
export function getLifecycleBreadcrumbLabel(previewingPendingChanges: boolean): string | undefined {
  return previewingPendingChanges
    ? t('dashboard-scene.lifecycle.breadcrumb-pending-changes', 'Pending changes')
    : undefined;
}
