import { reportInteraction } from '@grafana/runtime';
export const shareAnalyticsEventNames = {
    sharingCategoryClicked: 'dashboards_sharing_category_clicked',
    sharingActionClicked: 'dashboards_sharing_actions_clicked',
};
export function trackDashboardSharingTypeOpen(sharingType) {
    reportInteraction(shareAnalyticsEventNames.sharingCategoryClicked, { item: sharingType });
}
export function trackDashboardSharingActionPerType(action, sharingType) {
    reportInteraction(shareAnalyticsEventNames.sharingActionClicked, {
        item: action,
        sharing_category: sharingType,
    });
}
//# sourceMappingURL=analytics.js.map