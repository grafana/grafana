import { t } from '@grafana/i18n';

import { ResourceTableItem } from './types';

export function iconNameForResource(resource: ResourceTableItem['type']) {
  switch (resource) {
    case 'DASHBOARD':
      return 'dashboard';
    case 'FOLDER':
      return 'folder';
    case 'DATASOURCE':
      return 'database';
    case 'LIBRARY_ELEMENT':
      return 'library-panel';
    case 'MUTE_TIMING':
      return 'clock-nine';
    case 'NOTIFICATION_TEMPLATE':
      return 'file-alt';
    case 'CONTACT_POINT':
      return 'at';
    case 'NOTIFICATION_POLICY':
      return 'comment-alt';
    case 'ALERT_RULE':
      return 'bell';
    case 'ALERT_RULE_GROUP':
      return 'bell';
    case 'PLUGIN':
      return 'plug';
    default:
      return undefined;
  }
}

export function pluralizeResourceName(resource: ResourceTableItem['type']) {
  switch (resource) {
    case 'DASHBOARD':
      return t('migrate-to-cloud.resource-types.dashboard', 'Dashboards');
    case 'FOLDER':
      return t('migrate-to-cloud.resource-types.folder', 'Folders');
    case 'DATASOURCE':
      return t('migrate-to-cloud.resource-types.datasource', 'Data Sources');
    case 'LIBRARY_ELEMENT':
      return t('migrate-to-cloud.resource-types.library_element', 'Library Elements');
    case 'MUTE_TIMING':
      return t('migrate-to-cloud.resource-types.mute_timing', 'Mute Timings');
    case 'NOTIFICATION_TEMPLATE':
      return t('migrate-to-cloud.resource-types.notification_template', 'Notification Templates');
    case 'CONTACT_POINT':
      return t('migrate-to-cloud.resource-types.contact_point', 'Contact Points');
    case 'NOTIFICATION_POLICY':
      return t('migrate-to-cloud.resource-types.notification_policy', 'Notification Policies');
    case 'ALERT_RULE':
      return t('migrate-to-cloud.resource-types.alert_rule', 'Alert Rules');
    case 'ALERT_RULE_GROUP':
      return t('migrate-to-cloud.resource-types.alert_rule_group', 'Alert Rule Groups');
    case 'PLUGIN':
      return t('migrate-to-cloud.resource-types.plugin', 'Plugins');
    default:
      return undefined;
  }
}
