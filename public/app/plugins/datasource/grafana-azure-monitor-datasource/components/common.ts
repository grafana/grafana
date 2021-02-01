import { rangeUtil, SelectableValue } from '@grafana/data';
import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import TimegrainConverter from '../time_grain_converter';

export type Options = Array<SelectableValue<string>>;
export const findOption = (options: Options, value: string) => options.find((v) => v.value === value);
export const toOption = (v: { text: string; value: string }) => ({ value: v.value, label: v.text });

export interface MetricsQueryEditorFieldProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  replaceTemplateVariable: (variable: string) => string;

  onChange: <K extends keyof AzureMonitorQuery['azureMonitor']>(
    key: K,
    value: SelectableValue<AzureMonitorQuery['azureMonitor'][K]>
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
