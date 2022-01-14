import { DataModel, Status } from '../BackupInventory.types';

export interface BackupInventoryDetailsProps {
  name: string;
  status: Status;
  dataModel: DataModel;
}
