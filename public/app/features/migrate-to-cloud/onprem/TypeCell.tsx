import { CellProps } from '@grafana/ui';
// @todo: replace barrel import path
import { t } from 'app/core/internationalization/index';

// @todo: replace barrel import path
import { MigrateDataResponseItemDto } from '../api/index';

export function TypeCell(props: CellProps<MigrateDataResponseItemDto>) {
  const { type } = props.row.original;

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
