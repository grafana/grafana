import { reportInteraction } from '@grafana/runtime';

export const shareAnalyticsEventNames: {
  [key: string]: string;
} = {
  sharingCategoryClicked: 'dashboards_sharing_category_clicked',
  sharingActionClicked: 'dashboards_sharing_actions_clicked',
};

export function trackDashboardSharingTypeOpen(sharingType: string) {
  reportInteraction(shareAnalyticsEventNames.sharingCategoryClicked, { item: sharingType });
}

export function trackDashboardSharingActionPerType(action: string, sharingType: string) {
  reportInteraction(shareAnalyticsEventNames.sharingActionClicked, {
    item: action,
    sharing_category: sharingType,
  });
}
