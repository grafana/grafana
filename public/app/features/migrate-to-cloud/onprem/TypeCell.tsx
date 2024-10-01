import { CellProps } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ResourceTableItem } from './types';

export function prettyTypeName(type: ResourceTableItem['type']) {
  switch (type) {
    case 'DATASOURCE':
      return t('migrate-to-cloud.resource-type.datasource', 'Data source');
    case 'DASHBOARD':
      return t('migrate-to-cloud.resource-type.dashboard', 'Dashboard');
    case 'FOLDER':
      return t('migrate-to-cloud.resource-type.folder', 'Folder');
    case 'ALERT_RULE':
      return t('migrate-to-cloud.resource-type.alert-rule', 'Alert Rule');
    case 'CONTACT_POINT':
      return t('migrate-to-cloud.resource-type.contact-point', 'Contact Point');
    case 'NOTIFICATION_POLICY':
      return t('migrate-to-cloud.resource-type.notification-policy', 'Notification Policy');
    case 'NOTIFICATION_TEMPLATE':
      return t('migrate-to-cloud.resource-type.notification-template', 'Notification Template');
    default:
      return t('migrate-to-cloud.resource-type.unknown', 'Unknown');
  }
}

export function TypeCell(props: CellProps<ResourceTableItem>) {
  const { type } = props.row.original;
  return <>{prettyTypeName(type)}</>;
}
