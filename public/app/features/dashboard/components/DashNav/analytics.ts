import { reportInteraction } from '@grafana/runtime';

export function trackToolbarFavoritesClick() {
  reportInteraction('dashboards_toolbar_favorites_clicked', { item: 'favorites' });
}

export function trackToolbarSettingsClick() {
  reportInteraction('dashboards_toolbar_settings_clicked', { item: 'settings' });
}

export function trackToolbarRefreshClick() {
  reportInteraction('dashboards_toolbar_refresh_clicked', { item: 'refresh' });
}

export function trackToolbarTimePickerClick() {
  reportInteraction('dashboards_toolbar_time_picker_clicked', { item: 'time_picker' });
}

export function trackToolbarZoomClick() {
  reportInteraction('dashboards_toolbar_zoom_out_time_range_clicked', { item: 'zoom_out_time_range' });
}

export function trackToolbarShareClick() {
  reportInteraction('dashboards_toolbar_share_clicked', { item: 'share' });
}

export function trackToolbarSaveClick() {
  reportInteraction('dashboards_toolbar_save_clicked', { item: 'save' });
}

export function trackToolbarAddClick() {
  reportInteraction('dashboards_toolbar_add_clicked', { item: 'add' });
}
