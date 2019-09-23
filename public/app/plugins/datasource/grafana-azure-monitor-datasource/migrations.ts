import { AzureMonitorQueryCtrl } from './query_ctrl';

export function migrateTargetSchema(target: any) {
  if (target.azureMonitor && !target.azureMonitor.data) {
    const temp = {
      ...target.azureMonitor,
      dimensionFilters: [
        { filter: target.azureMonitor.dimensionFilter || '', dimension: target.azureMonitor.dimension || '' },
      ],
    };
    target.azureMonitor = {
      queryMode: AzureMonitorQueryCtrl.defaultQueryMode,
      data: {
        [AzureMonitorQueryCtrl.defaultQueryMode]: temp,
      },
    };
  }

  return target;
}
