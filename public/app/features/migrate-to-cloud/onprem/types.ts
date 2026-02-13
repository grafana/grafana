import { MigrateDataResponseItemDto } from '@grafana/api-clients/rtkq/legacy/migrate-to-cloud';

import { LocalPlugin } from '../../plugins/admin/types';

export interface ResourceTableItem extends MigrateDataResponseItemDto {
  showDetails: (resource: ResourceTableItem) => void;
  plugin: LocalPlugin | undefined;
}
