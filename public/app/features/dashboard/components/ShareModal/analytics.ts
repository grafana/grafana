import { reportInteraction } from '@grafana/runtime';

export const shareAnalyticsEventNames: {
  [key: string]: string;
} = {
  sharingCategoryClicked: 'dashboards_sharing_category_clicked',
};

export function trackDashboardSharingTypeOpen(sharingType: string) {
  reportInteraction(shareAnalyticsEventNames.sharingCategoryClicked, { item: sharingType });
}
