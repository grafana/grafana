import { t } from '@grafana/i18n';

export function buildBreakdownString(
  folderCount: number,
  dashboardCount: number,
  libraryPanelCount: number,
  alertRuleCount: number
) {
  const total = folderCount + dashboardCount + libraryPanelCount + alertRuleCount;
  const parts = [];
  if (folderCount) {
    parts.push(
      t('browse-dashboards.counts.folder', '', {
        count: folderCount,
        defaultValue_one: '{{count}} folder',
        defaultValue_other: '{{count}} folders',
      })
    );
  }
  if (dashboardCount) {
    parts.push(
      t('browse-dashboards.counts.dashboard', '', {
        count: dashboardCount,
        defaultValue_one: '{{count}} dashboard',
        defaultValue_other: '{{count}} dashboards',
      })
    );
  }
  if (libraryPanelCount) {
    parts.push(
      t('browse-dashboards.counts.libraryPanel', '', {
        count: libraryPanelCount,
        defaultValue_one: '{{count}} library panel',
        defaultValue_other: '{{count}} library panels',
      })
    );
  }
  if (alertRuleCount) {
    parts.push(
      t('browse-dashboards.counts.alertRule', '', {
        count: alertRuleCount,
        defaultValue_one: '{{count}} alert rule',
        defaultValue_other: '{{count}} alert rules',
      })
    );
  }
  let breakdownString = t('browse-dashboards.counts.total', '', {
    count: total,
    defaultValue_one: '{{count}} item',
    defaultValue_other: '{{count}} items',
  });
  if (parts.length > 0) {
    breakdownString += `: ${parts.join(', ')}`;
  }
  return breakdownString;
}
