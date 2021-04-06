import { DataModel, Status } from './BackupInventory.types';
import { Messages } from './BackupInventory.messages';

const { status: statusMsg, dataModel: dataModelMsg } = Messages;

export const formatStatus = (status: Status): string => {
  const map: Record<Status, string> = {
    [Status.STATUS_INVALID]: statusMsg.invalid,
    [Status.PENDING]: statusMsg.pending,
    [Status.IN_PROGRESS]: statusMsg.inProgress,
    [Status.PAUSED]: statusMsg.paused,
    [Status.SUCCESS]: statusMsg.success,
    [Status.ERROR]: statusMsg.error,
  };

  return map[status] ?? '';
};

export const formatDataModel = (model: DataModel): string => {
  const map: Record<DataModel, string> = {
    [DataModel.DATA_MODEL_INVALID]: dataModelMsg.invalid,
    [DataModel.PHYSICAL]: dataModelMsg.physical,
    [DataModel.LOGICAL]: dataModelMsg.logical,
  };

  return map[model] ?? '';
};
