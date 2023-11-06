import { reportInteraction } from '@grafana/runtime';

export const shareAnalyticsEventNames: {
  [key: string]: string;
} = {
  dashboardsToolbarActionsClicked: 'dashboards_toolbar_actions_clicked',
};

export function trackDashboardsToolbarActionsClicked(toolbarActionType: string) {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: toolbarActionType });
}
