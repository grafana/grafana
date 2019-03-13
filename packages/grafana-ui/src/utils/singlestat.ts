import { TableData, NullValueMode, SingleStatValueInfo } from '../types';
import { processTimeSeries } from './processTimeSeries';

export interface SingleStatProcessingOptions {
  data: TableData[];
  stat: string;
}

//
// This is a temporary thing, waiting for a better data model and maybe unification between time series & table data
//
export function processSingleStatPanelData(options: SingleStatProcessingOptions): SingleStatValueInfo[] {
  const { data, stat } = options;

  const timeSeries = processTimeSeries({
    data,
    xColumn: 0,
    yColumn: 1,
    nullValueMode: NullValueMode.Null,
  });

  return timeSeries.map((series, index) => {
    const value = stat !== 'name' ? series.stats[stat] : series.label;

    return {
      value: value,
    };
  });

  return [];
}
