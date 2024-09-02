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
    default:
      return t('migrate-to-cloud.resource-type.unknown', 'Unknown');
  }
}

export function TypeCell(props: CellProps<ResourceTableItem>) {
  const { type } = props.row.original;
  return <>{prettyTypeName(type)}</>;
}
