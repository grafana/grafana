import { t } from '@grafana/i18n';

export function getUidFieldLabel() {
  return t('manage-dashboards.import-dashboard-form.label-unique-identifier-uid', 'Unique identifier (UID)');
}

export function getUidFieldDescription() {
  return t(
    'manage-dashboards.import-dashboard-form.description-unique-identifier-uid',
    'The unique identifier (UID) of a dashboard can be used to uniquely identify a dashboard between multiple Grafana installs. The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any bookmarked links to that dashboard.'
  );
}
