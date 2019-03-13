import { PanelData, NullValueMode, SingleStatValueInfo } from '../types';
import { processTimeSeries } from './processTimeSeries';
import { DisplayValueOptions } from './displayValue';

export interface SingleStatProcessingOptions {
  panelData: PanelData;
  stat: string;
}

export interface SingleStatOptions {
  stat: string;
  display: DisplayValueOptions;
}

//
// This is a temporary thing, waiting for a better data model and maybe unification between time series & table data
//
export function processSingleStatPanelData(options: SingleStatProcessingOptions): SingleStatValueInfo[] {
  const { panelData, stat } = options;

  if (panelData.timeSeries) {
    const timeSeries = processTimeSeries({
      timeSeries: panelData.timeSeries,
      nullValueMode: NullValueMode.Null,
    });

    return timeSeries.map((series, index) => {
      const value = stat !== 'name' ? series.stats[stat] : series.label;

      return {
        value: value,
      };
    });
  } else if (panelData.tableData) {
    throw { message: 'Panel data not supported' };
  }

  return [];
}
