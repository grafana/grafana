import { PanelData } from '@grafana/data';
import { STAT, TIMESERIES } from '../utils/constants';

export function useVizHeight(data: PanelData, pluginId: string, frameIndex: number) {
  if (pluginId === TIMESERIES || pluginId === STAT || dataIsEmpty(data)) {
    return '200px';
  }

  const values = data.series[frameIndex].fields[0].values.length;
  const rowHeight = 40;
  const headerRow = rowHeight;

  const tableHeight = values * rowHeight + headerRow;

  return `${tableHeight >= 200 ? 200 : tableHeight}px`;
}

function dataIsEmpty(data: PanelData) {
  return !data || !data.series[0] || !data.series[0].fields[0] || !data.series[0].fields[0].values;
}
