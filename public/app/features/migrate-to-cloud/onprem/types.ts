import { MigrateDataResponseItemDto } from '../api';

export interface ResourceTableItem extends MigrateDataResponseItemDto {
  showError: (resource: ResourceTableItem) => void;
}
