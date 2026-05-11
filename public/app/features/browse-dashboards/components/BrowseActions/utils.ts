import { t } from '@grafana/i18n';
import { type DescendantCount } from 'app/types/folders';

import { type DashboardTreeSelection } from '../../types';

export function buildBreakdownString(
  folderCount: number,
  dashboardCount: number,
  libraryPanelCount: number,
  alertRuleCount: number
) {
  const total = folderCount + dashboardCount + libraryPanelCount + alertRuleCount;
  const parts = [];
  if (folderCount) {
    parts.push(t('browse-dashboards.counts.folder', '{{count}} folder', { count: folderCount }));
  }
  if (dashboardCount) {
    parts.push(t('browse-dashboards.counts.dashboard', '{{count}} dashboard', { count: dashboardCount }));
  }
  if (libraryPanelCount) {
    parts.push(t('browse-dashboards.counts.libraryPanel', '{{count}} library panel', { count: libraryPanelCount }));
  }
  if (alertRuleCount) {
    parts.push(t('browse-dashboards.counts.alertRule', '{{count}} alert rule', { count: alertRuleCount }));
  }
  let breakdownString = t('browse-dashboards.counts.total', '{{count}} item', { count: total });
  if (parts.length > 0) {
    breakdownString += `: ${parts.join(', ')}`;
  }
  return breakdownString;
}

/**
 * Returns true when the selected folders have no remaining descendants once items the user explicitly selected
 * (folders/dashboards) are subtracted from the affected-items totals. Returns undefined while counts haven't loaded
 * yet so callers can render a loading state.
 *
 * We do this mainly beacuse the way the API works, ie returning affected items does not currently match the UI, which
 * only needs whether folders have children items.
 */
export function getFolderIsEmpty(
  affectedItems: DescendantCount | undefined,
  selectedItems: Pick<DashboardTreeSelection, 'folder' | 'dashboard'>
): boolean | undefined {
  if (!affectedItems) {
    return undefined;
  }

  const selectedFolderCount = Object.values(selectedItems.folder).filter(Boolean).length;
  const selectedDashboardCount = Object.values(selectedItems.dashboard).filter(Boolean).length;

  const remaining =
    affectedItems.folders -
    selectedFolderCount +
    (affectedItems.dashboards - selectedDashboardCount) +
    affectedItems.library_elements +
    affectedItems.alertrules;

  return remaining === 0;
}
