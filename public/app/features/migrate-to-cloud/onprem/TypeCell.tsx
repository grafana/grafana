import { CellProps } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { MigrationResourceDTOMock } from '../mockAPI';

export function TypeCell(props: CellProps<MigrationResourceDTOMock>) {
  const { type } = props.row.original;

  if (type === 'datasource') {
    return t('migrate-to-cloud.resource-type.datasource', 'Data source');
  }

  if (type === 'dashboard') {
    return t('migrate-to-cloud.resource-type.dashboard', 'Dashboard');
  }

  return t('migrate-to-cloud.resource-type.unknown', 'Unknown');
}
