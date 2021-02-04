import { rangeUtil } from '@grafana/data';
import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import TimegrainConverter from '../time_grain_converter';

export type Option = { label: string; value: string };
export const findOption = (options: Option[], value: string) => options.find((v) => v.value === value);
export const toOption = (v: { text: string; value: string }) => ({ value: v.value, label: v.text });

export interface MetricsQueryEditorFieldProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;

  onChange: <K extends keyof AzureMonitorQuery['azureMonitor']>(
    key: K,
    value: AzureMonitorQuery['azureMonitor'][K]
  ) => void;
}

export function convertTimeGrainsToMs(timeGrains: Array<{ text: string; value: string }>) {
  const allowedTimeGrainsMs: number[] = [];
  timeGrains.forEach((tg: any) => {
    if (tg.value !== 'auto') {
      allowedTimeGrainsMs.push(rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
    }
  });
  return allowedTimeGrainsMs;
}
