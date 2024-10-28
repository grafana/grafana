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
    case 'LIBRARY_ELEMENT':
      return t('migrate-to-cloud.resource-type.library_element', 'Library Element');
    case 'MUTE_TIMING':
      return t('migrate-to-cloud.resource-type.mute_timing', 'Mute Timing');
    case 'NOTIFICATION_TEMPLATE':
      return t('migrate-to-cloud.resource-type.notification_template', 'Notification Template');
    case 'CONTACT_POINT':
      return t('migrate-to-cloud.resource-type.contact_point', 'Contact Point');
    case 'NOTIFICATION_POLICY':
      return t('migrate-to-cloud.resource-type.notification_policy', 'Notification Policy');
    case 'ALERT_RULE':
      return t('migrate-to-cloud.resource-type.alert_rule', 'Alert Rule');
    default:
      return t('migrate-to-cloud.resource-type.unknown', 'Unknown');
  }
}

export function TypeCell(props: CellProps<ResourceTableItem>) {
  const { type } = props.row.original;
  return <>{prettyTypeName(type)}</>;
}
