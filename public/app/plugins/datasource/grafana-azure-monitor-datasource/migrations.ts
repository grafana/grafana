import { AzureMonitorQueryCtrl } from './query_ctrl';

export function migrateTargetSchema(target: any) {
  if (target.azureMonitor && !target.azureMonitor.data) {
    const temp = { ...target.azureMonitor };
    target.azureMonitor = {
      queryMode: AzureMonitorQueryCtrl.defaultQueryMode,
      data: {
        [AzureMonitorQueryCtrl.defaultQueryMode]: temp,
      },
    };
  }

  return target;
}
