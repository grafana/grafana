import { MigrateDataResponseItemDto } from '../api';

export interface ResourceTableItem extends MigrateDataResponseItemDto {
  showDetails: (resource: ResourceTableItem) => void;
}
