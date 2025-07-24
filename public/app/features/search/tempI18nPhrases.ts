// Temporary place to collect phrases we reuse between new and old browse/search
// TODO: remove this when new Browse Dashboards UI is no longer feature flagged

import { t } from '@grafana/i18n';

export function getSearchPlaceholder(includePanels = false) {
  return includePanels
    ? t('search.search-input.include-panels-placeholder', 'Search for dashboards, folders, and panels')
    : t('search.search-input.placeholder', 'Search for dashboards and folders');
}

export function getNewDashboardPhrase() {
  return t('search.dashboard-actions.new-dashboard', 'New dashboard');
}

export function getNewFolderPhrase() {
  return t('search.dashboard-actions.new-folder', 'New folder');
}

export function getImportPhrase() {
  return t('search.dashboard-actions.import', 'Import');
}

export function getNewPhrase() {
  return t('search.dashboard-actions.new', 'New');
}
