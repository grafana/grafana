import { rangeUtil } from '@grafana/data';
import TimegrainConverter from '../time_grain_converter';
import { Option } from '../types';

// Defaults to returning a fallback option so the UI still shows the value while the API is loading
export const findOption = (options: Option[], value: string) =>
  options.find((v) => v.value === value) ?? { value, label: value };

export const toOption = (v: { text: string; value: string }) => ({ value: v.value, label: v.text });

export function convertTimeGrainsToMs(timeGrains: Array<{ text: string; value: string }>) {
  const allowedTimeGrainsMs: number[] = [];
  timeGrains.forEach((tg: any) => {
    if (tg.value !== 'auto') {
      allowedTimeGrainsMs.push(rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(tg.value)));
    }
  });
  return allowedTimeGrainsMs;
}
