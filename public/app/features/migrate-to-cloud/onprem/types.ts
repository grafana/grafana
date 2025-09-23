import { LocalPlugin } from '../../plugins/admin/types';
import { MigrateDataResponseItemDto } from '../api';

export interface ResourceTableItem extends MigrateDataResponseItemDto {
  showDetails: (resource: ResourceTableItem) => void;
  plugin: LocalPlugin | undefined;
}
