import { Labels } from '@grafana/data';

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function labelsToMatchers(labels: Labels) {
  return Object.entries(labels).map(([label, value]) => ({
    label,
    type: '=' as const,
    value,
  }));
}

export const noop = () => {};
