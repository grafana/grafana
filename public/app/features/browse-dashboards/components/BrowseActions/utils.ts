import { t } from '@grafana/i18n';

import { findItem } from '../../state/utils';

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

// Utility: Get root folder for any item (reusing existing pattern from reducers.ts)
export function getItemRootFolder(
  item: { uid: string; parentUID?: string; kind?: string },
  browseState: { rootItems?: { items: any[] }; childrenByParentUID: Record<string, any> }
): string | undefined {
  const rootItems = browseState.rootItems?.items || [];

  // If it's already a root-level item, return its UID (only for folders)
  if (!item.parentUID) {
    return item.kind === 'folder' ? item.uid : undefined;
  }

  // For nested items, traverse up to find root folder (same pattern as reducers.ts)
  let nextParentUID = item.parentUID;

  while (nextParentUID) {
    const parent = findItem(rootItems, browseState.childrenByParentUID, nextParentUID);

    // Safety check to prevent infinite loops (same as reducers.ts)
    if (!parent) {
      break;
    }

    // Found the root folder (no parent)
    if (!parent.parentUID) {
      return parent.uid;
    }

    nextParentUID = parent.parentUID;
  }

  return undefined;
}
