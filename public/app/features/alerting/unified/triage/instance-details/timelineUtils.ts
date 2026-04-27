import { dateTimeFormat } from '@grafana/data/datetime';
import type { Labels } from '@grafana/data/types';

const TIMELINE_DATE_FORMAT = 'MMM DD, HH:mm:ss';

export function formatTimelineDate(timestamp: number | string): string {
  return dateTimeFormat(timestamp, { format: TIMELINE_DATE_FORMAT });
}

export function labelsToMatchers(labels: Labels) {
  return Object.entries(labels).map(([label, value]) => ({
    label,
    type: '=' as const,
    value,
  }));
}

export const noop = () => {};
