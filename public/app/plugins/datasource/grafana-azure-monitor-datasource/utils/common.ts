import { rangeUtil } from '@grafana/data';
import TimegrainConverter from '../time_grain_converter';
import { AzureMonitorOption } from '../types';

// Defaults to returning a fallback option so the UI still shows the value while the API is loading
export const findOption = (options: AzureMonitorOption[], value: string | undefined) =>
  value ? options.find((v) => v.value === value) ?? { value, label: value } : null;

export const toOption = (v: { text: string; value: string }) => ({ value: v.value, label: v.text });

export function convertTimeGrainsToMs<T extends { value: string }>(timeGrains: T[]) {
  const allowedTimeGrainsMs: number[] = [];
  timeGrains.forEach((tg: any) => {
    if (tg.value !== 'auto') {
      allowedTimeGrainsMs.push(rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
    }
  });
  return allowedTimeGrainsMs;
}
