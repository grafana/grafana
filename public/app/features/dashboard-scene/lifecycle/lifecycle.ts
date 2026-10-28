import { t } from '@grafana/i18n';

import { type PendingChangePreview, proposesNewDashboard } from './pendingChangePreview';

/**
 * Label shown next to the dashboard title in the breadcrumbs while it shows pending changes: a new
 * dashboard's are a draft until it is saved.
 */
export function getLifecycleBreadcrumbLabel(preview: PendingChangePreview | undefined): string | undefined {
  if (!preview?.previewing) {
    return undefined;
  }
  return proposesNewDashboard(preview.pending)
    ? t('dashboard-scene.lifecycle.breadcrumb-draft', 'Draft')
    : t('dashboard-scene.lifecycle.breadcrumb-pending-changes', 'Pending changes');
}
