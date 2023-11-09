import { reportInteraction } from '@grafana/runtime';

export const shareAnalyticsEventNames: {
  [key: string]: string;
} = {
  dashboardsToolbarActionsClicked: 'dashboards_toolbar_actions_clicked',
};

export function trackToolbarFavoritesClick() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'favorites' });
}

export function trackToolbarSettingsClick() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'settings' });
}

export function trackToolbarRefreshClick() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'refresh' });
}

export function trackToolbarTimePickerClick() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'time_picker' });
}

export function trackToolbarZoomClick() {
  reportInteraction(shareAnalyticsEventNames.dashboardsToolbarActionsClicked, { item: 'zoom_out_time_range' });
}
