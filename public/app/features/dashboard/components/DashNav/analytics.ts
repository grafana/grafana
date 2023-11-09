import { reportInteraction } from '@grafana/runtime';

export const shareAnalyticsEventNames: {
  [key: string]: string;
} = {
  dashboardsToolbarActionsClicked: 'dashboards_toolbar_actions_clicked',
};

export function trackToolbarFavoritesClicked() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'favorites' });
}

export function trackToolbarSettingsClicked() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'settings' });
}

export function trackToolbarRefreshClicked() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'refresh' });
}

export function trackToolbarTimePickerClicked() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'time_picker' });
}

export function trackToolbarZoomClicked() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'zoom_out_time_range' });
}
